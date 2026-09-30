from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DevicePlatform(StrEnum):
    IOS = "ios"
    ANDROID = "android"


class RegisterDeviceRequest(BaseModel):
    token: str = Field(min_length=1, max_length=512)
    platform: DevicePlatform

    @field_validator("token")
    @classmethod
    def _strip_token(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("token must not be blank")
        return stripped


class Device(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    platform: DevicePlatform
    active: bool
    updated_at: datetime
