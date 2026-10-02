import asyncpg
import logging
from uuid import UUID, uuid4

from app.core.config import get_settings
from app.schemas.admin import (
    AccessStatus,
    Tenant,
    TenantCreate,
    TenantCreated,
    TenantList,
    TenantStatusUpdateResult,
    TenantUser,
    TenantUserCreate,
    TenantUserCreated,
    TenantUserList,
)
from app.services.tenant_invites import SupabaseInviter

logger = logging.getLogger(__name__)


class TenantNotFoundError(Exception):
    pass


class TenantUserNotFoundError(Exception):
    pass


class TenantService:
    def __init__(self, connection: asyncpg.Connection) -> None:
        self.connection = connection

    async def create(self, values: TenantCreate, inviter: SupabaseInviter) -> TenantCreated:
        email = values.vendor_email.lower()
        settings = get_settings()
        user_id = await inviter.invite(
            email, values.vendor_name,
            redirect_url=settings.tenant_admin_invite_redirect_url,
        )
        tenant_id = uuid4()
        local_shadow = settings.local_auth_shadow
        try:
            if local_shadow:
                await self.connection.execute(
                    "select public.create_local_auth_shadow($1, $2)", user_id, email,
                )
            await self.connection.execute(
                "insert into public.tenants (id, name) values ($1, $2)",
                tenant_id, values.name,
            )
            await self.connection.execute(
                """insert into public.users (id, tenant_id, role, display_name, email)
                   values ($1, $2, 'tenant_admin', $3, $4)""",
                user_id, tenant_id, values.vendor_name, email,
            )
        except Exception:
            try:
                await inviter.delete(user_id)
            except Exception:
                logger.exception("Could not remove invited Auth user after tenant insert failed")
            raise
        return TenantCreated(
            id=tenant_id, name=values.name, owner_user_id=user_id,
            vendor_email=email, invitation_sent=True,
        )

    async def create_user(
        self, tenant_id: UUID, values: TenantUserCreate, inviter: SupabaseInviter,
    ) -> TenantUserCreated:
        tenant = await self.connection.fetchrow(
            "select id from public.tenants where id = $1", tenant_id,
        )
        if tenant is None:
            raise TenantNotFoundError

        email = values.email.lower()
        user_id = await inviter.invite(email, values.display_name)
        local_shadow = get_settings().local_auth_shadow
        try:
            if local_shadow:
                await self.connection.execute(
                    "select public.create_local_auth_shadow($1, $2)", user_id, email,
                )
            row = await self.connection.fetchrow(
                """
                insert into public.users (
                  id, tenant_id, role, display_name, email
                ) values ($1, $2, 'vendor', $3, $4)
                returning id, tenant_id, display_name, email, status,
                          created_at, updated_at
                """,
                user_id, tenant_id, values.display_name, email,
            )
        except Exception:
            try:
                await inviter.delete(user_id)
            except Exception:
                logger.exception(
                    "Could not remove invited Auth user after tenant-user insert failed"
                )
            raise
        return TenantUserCreated.model_validate(
            {**dict(row), "invitation_sent": True}
        )

    async def list_users(self, tenant_id: UUID) -> TenantUserList:
        tenant_exists = await self.connection.fetchval(
            "select exists(select 1 from public.tenants where id = $1)", tenant_id,
        )
        if not tenant_exists:
            raise TenantNotFoundError
        rows = await self.connection.fetch(
            """
            select id, tenant_id, display_name, email, status, created_at, updated_at
            from public.users
            where tenant_id = $1 and role = 'vendor'
            order by created_at, display_name
            """,
            tenant_id,
        )
        return TenantUserList(
            items=[TenantUser.model_validate(dict(row)) for row in rows],
            total=len(rows),
        )

    async def update_status(
        self, tenant_id: UUID, new_status: AccessStatus,
    ) -> TenantStatusUpdateResult:
        row = await self.connection.fetchrow(
            """
            update public.tenants
            set status = $2, updated_at = now()
            where id = $1
            returning id, status, updated_at
            """,
            tenant_id, new_status,
        )
        if row is None:
            raise TenantNotFoundError
        return TenantStatusUpdateResult.model_validate(dict(row))

    async def update_user_status(
        self, tenant_id: UUID, user_id: UUID, new_status: AccessStatus,
    ) -> TenantUser:
        row = await self.connection.fetchrow(
            """
            update public.users
            set status = $3, updated_at = now()
            where id = $2 and tenant_id = $1 and role = 'vendor'
            returning id, tenant_id, display_name, email, status,
                      created_at, updated_at
            """,
            tenant_id, user_id, new_status,
        )
        if row is None:
            raise TenantUserNotFoundError
        return TenantUser.model_validate(dict(row))

    async def list(
        self, *, limit: int, offset: int, search: str = "",
        status: str | None = None, tenant_id: UUID | None = None,
    ) -> TenantList:
        rows = await self.connection.fetch(
            """
            select
              tenants.id,
              tenants.name,
              tenants.status,
              tenants.created_at,
              tenants.updated_at,
              coalesce(scan_totals.last_active_at, tenants.updated_at) as last_active_at,
              coalesce(member_totals.member_count, 0)::int as member_count,
              coalesce(product_totals.catalogue_coverage, 0)::int as catalogue_coverage,
              coalesce(scan_totals.scans_this_month, 0)::int as scans_this_month,
              coalesce(scan_totals.fresh_scans_this_month, 0)::int as fresh_scans_this_month,
              coalesce(scan_totals.medium_scans_this_month, 0)::int as medium_scans_this_month,
              coalesce(scan_totals.spoiled_scans_this_month, 0)::int as spoiled_scans_this_month,
              coalesce(alert_totals.active_alerts, 0)::int as active_alerts,
              primary_contact.display_name as primary_contact_name,
              primary_contact.email as primary_contact_email,
              count(*) over()::int as total
            from public.tenants
            left join lateral (
              select count(*)::int as member_count
              from public.users
              where users.tenant_id = tenants.id
            ) member_totals on true
            left join lateral (
              select count(*)::int as catalogue_coverage
              from public.products
            ) product_totals on true
            left join lateral (
              select
                max(scans.updated_at) as last_active_at,
                count(*) filter (
                  where scans.created_at >= date_trunc('month', now())
                )::int as scans_this_month,
                count(*) filter (
                  where scans.created_at >= date_trunc('month', now())
                    and scans.classification = 'fresh'
                )::int as fresh_scans_this_month,
                count(*) filter (
                  where scans.created_at >= date_trunc('month', now())
                    and scans.classification = 'medium'
                )::int as medium_scans_this_month,
                count(*) filter (
                  where scans.created_at >= date_trunc('month', now())
                    and scans.classification = 'spoiled'
                )::int as spoiled_scans_this_month
              from public.scans
              where scans.tenant_id = tenants.id
            ) scan_totals on true
            left join lateral (
              select count(*)::int as active_alerts
              from public.alerts
              where alerts.tenant_id = tenants.id
            ) alert_totals on true
            left join lateral (
              select users.display_name, users.email
              from public.users
              where users.tenant_id = tenants.id
                and users.role in ('tenant_admin', 'vendor')
              order by case when users.role = 'tenant_admin' then 0 else 1 end,
                       users.created_at
              limit 1
            ) primary_contact on true
            where ($3 = '' or tenants.name ilike '%' || $3 || '%'
              or primary_contact.display_name ilike '%' || $3 || '%'
              or primary_contact.email ilike '%' || $3 || '%')
              and ($4::text is null or tenants.status::text = $4)
              and ($5::uuid is null or tenants.id = $5)
            order by tenants.created_at desc
            limit $1 offset $2
            """,
            limit,
            offset,
            search,
            status,
            tenant_id,
        )
        items = [Tenant.model_validate(dict(row)) for row in rows]
        total = int(rows[0]["total"]) if rows else 0
        return TenantList(items=items, total=total, limit=limit, offset=offset)
