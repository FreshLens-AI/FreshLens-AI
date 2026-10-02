import asyncio
from collections.abc import Sequence
from uuid import UUID, uuid4

from fastapi.testclient import TestClient

from app.core.rate_limit import get_rate_limiter
from app.main import app
from app.routers.sales import get_sellable_products
from app.services.voice_draft import (
    UNMATCHED_AMBIGUITY,
    ParsedDraft,
    ParsedLine,
    ProductCandidate,
    VoiceParserUnavailableError,
    build_draft,
    create_voice_draft,
    get_voice_parser,
)
from tests.conftest import StaticVerifier
from tests.test_auth import admin_claims, vendor_claims

TOMATO = ProductCandidate(id=uuid4(), name="Tomato")
BANANA = ProductCandidate(id=uuid4(), name="Banana")
AUTH = {"Authorization": "Bearer valid"}


def _line(
    spoken: str,
    quantity: int,
    ref: str | None,
    confidence: float = 0.9,
    ambiguity: str | None = None,
) -> ParsedLine:
    return ParsedLine(
        spoken_product=spoken,
        quantity=quantity,
        product_ref=ref,
        confidence=confidence,
        ambiguity=ambiguity,
    )


class FakeParser:
    def __init__(self, result: ParsedDraft | Exception) -> None:
        self.result = result
        self.calls: list[tuple[str, list[str]]] = []

    async def parse(
        self, transcript: str, products: Sequence[ProductCandidate]
    ) -> ParsedDraft:
        self.calls.append((transcript, [product.name for product in products]))
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


class FakeLimiter:
    def __init__(self, allowed: bool = True) -> None:
        self.allowed = allowed
        self.tenants: list[UUID] = []

    async def allow(self, tenant_id: UUID, route: str, limit: int) -> bool:
        self.tenants.append(tenant_id)
        return self.allowed


def _override(
    parser: FakeParser | None,
    limiter: FakeLimiter | None = None,
    products: list[ProductCandidate] | None = None,
) -> None:
    app.dependency_overrides[get_voice_parser] = lambda: parser
    app.dependency_overrides[get_rate_limiter] = lambda: limiter or FakeLimiter()
    app.dependency_overrides[get_sellable_products] = lambda: (
        [TOMATO, BANANA] if products is None else products
    )


def test_build_draft_maps_refs_and_multiple_items() -> None:
    parsed = ParsedDraft(
        items=[_line("tomato", 2, "p1"), _line("kesel", 3, "p2", 0.7)], warnings=[]
    )

    draft = build_draft(parsed, [TOMATO, BANANA])

    assert [item.matched_product_id for item in draft.items] == [TOMATO.id, BANANA.id]
    assert [item.quantity_sold for item in draft.items] == [2, 3]
    assert draft.requires_confirmation is True


def test_build_draft_drops_unknown_refs_and_flags_ambiguity() -> None:
    parsed = ParsedDraft(items=[_line("mango", 1, "p9", 0.95)], warnings=[])

    draft = build_draft(parsed, [TOMATO])

    item = draft.items[0]
    assert item.matched_product_id is None
    assert item.confidence == 0.0
    assert item.ambiguity == UNMATCHED_AMBIGUITY


def test_build_draft_skips_non_positive_quantities_and_clamps_confidence() -> None:
    parsed = ParsedDraft(
        items=[_line("tomato", 0, "p1"), _line("tomato", 4, "p1", 1.7)], warnings=[]
    )

    draft = build_draft(parsed, [TOMATO])

    assert len(draft.items) == 1
    assert draft.items[0].confidence == 1.0
    assert any("positive" in warning for warning in draft.warnings)


def test_build_draft_warns_when_nothing_recognised() -> None:
    draft = build_draft(ParsedDraft(items=[], warnings=[]), [TOMATO])

    assert draft.items == []
    assert draft.warnings


def test_no_stock_skips_the_parser() -> None:
    parser = FakeParser(ParsedDraft(items=[], warnings=[]))

    draft = asyncio.run(create_voice_draft(parser, "two tomatoes", []))

    assert parser.calls == []
    assert draft.warnings


def test_missing_parser_is_unavailable() -> None:
    try:
        asyncio.run(create_voice_draft(None, "two tomatoes", [TOMATO]))
    except VoiceParserUnavailableError:
        return
    raise AssertionError("expected VoiceParserUnavailableError")


def test_endpoint_returns_draft_without_touching_stock(
    client: TestClient, verifier: StaticVerifier
) -> None:
    parser = FakeParser(
        ParsedDraft(items=[_line("thakkali", 2, "p1")], warnings=[])
    )
    limiter = FakeLimiter()
    _override(parser, limiter)
    claims = vendor_claims()
    verifier.claims = claims
    try:
        response = client.post(
            "/api/v1/sales/voice-draft",
            json={"transcript": "  thakkali deka  "},
            headers=AUTH,
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert body["requires_confirmation"] is True
    assert body["items"][0]["matched_product_id"] == str(TOMATO.id)
    assert parser.calls == [("thakkali deka", ["Tomato", "Banana"])]
    # Rate limit key comes from the JWT tenant, never the request body.
    assert limiter.tenants == [UUID(str(claims["tenant_id"]))]


def test_endpoint_rejects_extra_fields(
    client: TestClient, verifier: StaticVerifier
) -> None:
    _override(FakeParser(ParsedDraft(items=[], warnings=[])))
    verifier.claims = vendor_claims()
    try:
        response = client.post(
            "/api/v1/sales/voice-draft",
            json={"transcript": "two tomatoes", "tenant_id": str(uuid4())},
            headers=AUTH,
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422


def test_endpoint_returns_503_when_parser_fails(
    client: TestClient, verifier: StaticVerifier
) -> None:
    _override(FakeParser(VoiceParserUnavailableError("down")))
    verifier.claims = vendor_claims()
    try:
        response = client.post(
            "/api/v1/sales/voice-draft",
            json={"transcript": "two tomatoes"},
            headers=AUTH,
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 503


def test_endpoint_returns_429_when_rate_limited(
    client: TestClient, verifier: StaticVerifier
) -> None:
    parser = FakeParser(ParsedDraft(items=[], warnings=[]))
    _override(parser, FakeLimiter(allowed=False))
    verifier.claims = vendor_claims()
    try:
        response = client.post(
            "/api/v1/sales/voice-draft",
            json={"transcript": "two tomatoes"},
            headers=AUTH,
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 429
    assert response.headers["Retry-After"] == "60"
    assert parser.calls == []


def test_endpoint_requires_tenant_member(
    client: TestClient, verifier: StaticVerifier
) -> None:
    _override(FakeParser(ParsedDraft(items=[], warnings=[])))
    verifier.claims = admin_claims()
    try:
        response = client.post(
            "/api/v1/sales/voice-draft",
            json={"transcript": "two tomatoes"},
            headers=AUTH,
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 403
