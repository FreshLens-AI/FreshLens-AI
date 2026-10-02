import logging
from uuid import UUID

import asyncpg

from app.schemas.admin import TenantCreate
from app.schemas.applications import (
    TenantApplication,
    TenantApplicationCreate,
    TenantApplicationList,
    TenantApplicationReview,
    TenantApplicationSubmitted,
)
from app.services.tenant_invites import SupabaseInviter
from app.services.tenants import TenantService

logger = logging.getLogger(__name__)


class ApplicationNotFoundError(Exception):
    pass


class ApplicationStateError(Exception):
    pass


class TenantApplicationService:
    _columns = """id, organization_name, applicant_name, applicant_email, phone,
        status, review_note, reviewed_by, approved_tenant_id, approved_user_id,
        submitted_at, reviewed_at, updated_at"""

    def __init__(self, connection: asyncpg.Connection) -> None:
        self.connection = connection

    async def submit(
        self, values: TenantApplicationCreate,
    ) -> TenantApplicationSubmitted:
        application_id = await self.connection.fetchval(
            "select public.submit_tenant_application($1, $2, $3, $4)",
            values.organization_name, values.applicant_name,
            values.applicant_email.lower(), values.phone,
        )
        return TenantApplicationSubmitted(id=application_id)

    async def list(
        self, *, status: str | None, limit: int, offset: int,
    ) -> TenantApplicationList:
        rows = await self.connection.fetch(
            f"""select {self._columns}, count(*) over()::int as total
                from public.tenant_applications
                where ($1::text is null or status::text = $1)
                order by submitted_at desc limit $2 offset $3""",
            status, limit, offset,
        )
        return TenantApplicationList(
            items=[TenantApplication.model_validate(dict(row)) for row in rows],
            total=int(rows[0]["total"]) if rows else 0,
            limit=limit, offset=offset,
        )

    async def approve(
        self, application_id: UUID, reviewer_id: UUID,
        review: TenantApplicationReview, inviter: SupabaseInviter,
    ) -> TenantApplication:
        application = await self.connection.fetchrow(
            f"""select {self._columns} from public.tenant_applications
                where id = $1 for update""",
            application_id,
        )
        if application is None:
            raise ApplicationNotFoundError
        if application["status"] == "approved":
            return TenantApplication.model_validate(dict(application))
        if application["status"] != "pending":
            raise ApplicationStateError("Only pending applications can be approved.")

        created = await TenantService(self.connection).create(
            TenantCreate(
                name=application["organization_name"],
                vendor_name=application["applicant_name"],
                vendor_email=application["applicant_email"],
            ),
            inviter,
        )
        try:
            row = await self.connection.fetchrow(
                f"""update public.tenant_applications
                    set status = 'approved', review_note = $3, reviewed_by = $2,
                        approved_tenant_id = $4, approved_user_id = $5,
                        reviewed_at = now(), updated_at = now()
                    where id = $1 returning {self._columns}""",
                application_id, reviewer_id, review.note,
                created.id, created.owner_user_id,
            )
        except Exception:
            try:
                await inviter.delete(created.owner_user_id)
            except Exception:
                logger.exception("Could not clean up approved tenant invitation")
            raise
        return TenantApplication.model_validate(dict(row))

    async def reject(
        self, application_id: UUID, reviewer_id: UUID,
        review: TenantApplicationReview,
    ) -> TenantApplication:
        row = await self.connection.fetchrow(
            f"""update public.tenant_applications
                set status = 'rejected', review_note = $3, reviewed_by = $2,
                    reviewed_at = now(), updated_at = now()
                where id = $1 and status = 'pending'
                returning {self._columns}""",
            application_id, reviewer_id, review.note,
        )
        if row is not None:
            return TenantApplication.model_validate(dict(row))
        exists = await self.connection.fetchval(
            "select exists(select 1 from public.tenant_applications where id = $1)",
            application_id,
        )
        if not exists:
            raise ApplicationNotFoundError
        raise ApplicationStateError("Only pending applications can be rejected.")
