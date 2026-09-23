from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import asdict, is_dataclass
from datetime import datetime
from importlib.metadata import version
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from mcp.server import MCPServer
from mcp.server.transport_security import TransportSecuritySettings
from pydantic import BaseModel, Field

from tianzhi_core.bazi import chart, geju, score, strength, tiaohou, yongshen


mcp = MCPServer("Tianzhi Core")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    async with mcp.session_manager.run():
        yield


app = FastAPI(
    title="Tianzhi Core API",
    version="0.2.0",
    description="HTTP + MCP wrapper around tianzhi-core. Deterministic calculation first; interpretation belongs to the caller.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Mcp-Session-Id"],
)


class ChartRequest(BaseModel):
    birth: datetime = Field(description="Birth clock time. Naive datetimes follow tianzhi-core semantics (China standard time).")
    longitude: float = Field(default=0.0, ge=-180.0, le=180.0)
    gender: Literal[0, 1] = 0
    use_true_solar: bool = True
    late_zi: Literal["next_day", "same_day"] = "next_day"
    priority: list[str] | None = Field(
        default=None,
        description="Optional yongshen priority, e.g. ['格局','扶抑','通关','病药','调候'].",
    )


class YearRequest(ChartRequest):
    year_ganzhi: str = Field(min_length=2, max_length=2, description="Flow-year ganzhi, e.g. 丙午.")
    dayun_ganzhi: str | None = Field(default=None, min_length=2, max_length=2)


def _plain(value: Any) -> Any:
    if value is None:
        return None
    if is_dataclass(value):
        return jsonable_encoder(asdict(value))
    if hasattr(value, "_asdict"):
        return jsonable_encoder(value._asdict())
    return jsonable_encoder(value)


def _build(req: ChartRequest) -> chart.Chart:
    return chart.build_chart(
        req.birth,
        longitude=req.longitude,
        gender=req.gender,
        use_true_solar=req.use_true_solar,
        late_zi=req.late_zi,
    )


def _select_yongshen(c: chart.Chart, req: ChartRequest):
    if req.priority is None:
        return yongshen.select(c.quad, month_siling=c.siling)
    return yongshen.select(c.quad, month_siling=c.siling, priority=tuple(req.priority))


def _analysis(c: chart.Chart, req: ChartRequest) -> dict[str, Any]:
    body = strength.day_master_strength(c.quad, month_siling=c.siling)
    ys = _select_yongshen(c, req)
    pattern = geju.month_pattern(c.quad, month_siling=c.siling)
    climate_need = tiaohou.climate_need(c.quad)

    yong = _plain(ys)
    yong["favorable"] = list(ys.favorable)
    yong["unfavorable"] = list(ys.unfavorable)

    return {
        "chart": c.to_dict(),
        "strength": _plain(body),
        "element_power": strength.element_power(c.quad, month_siling=c.siling),
        "ten_god_power": strength.ten_god_power(c.quad, month_siling=c.siling),
        "climate_index": strength.climate_index(c.quad),
        "pattern": _plain(pattern),
        "tiaohou": _plain(climate_need),
        "yongshen": yong,
    }


def _chart_req(
    birth: str,
    longitude: float,
    gender: int,
    use_true_solar: bool,
    late_zi: str,
) -> ChartRequest:
    return ChartRequest.model_validate(
        {
            "birth": birth,
            "longitude": longitude,
            "gender": gender,
            "use_true_solar": use_true_solar,
            "late_zi": late_zi,
        }
    )


@mcp.tool()
def bazi_chart(
    birth: str,
    longitude: float = 0.0,
    gender: int = 0,
    use_true_solar: bool = True,
    late_zi: str = "next_day",
) -> dict[str, Any]:
    """Build a deterministic BaZi chart from a birth timestamp and optional longitude."""
    req = _chart_req(birth, longitude, gender, use_true_solar, late_zi)
    c = _build(req)
    return {"engine_version": version("tianzhi-core"), "chart": c.to_dict()}


@mcp.tool()
def bazi_analysis(
    birth: str,
    longitude: float = 0.0,
    gender: int = 0,
    use_true_solar: bool = True,
    late_zi: str = "next_day",
) -> dict[str, Any]:
    """Return chart, strength, five-element power, ten-god power, pattern, tiaohou and yongshen."""
    req = _chart_req(birth, longitude, gender, use_true_solar, late_zi)
    c = _build(req)
    return {"engine_version": version("tianzhi-core"), **_analysis(c, req)}


@mcp.tool()
def bazi_year(
    birth: str,
    year_ganzhi: str,
    longitude: float = 0.0,
    gender: int = 0,
    use_true_solar: bool = True,
    late_zi: str = "next_day",
    dayun_ganzhi: str | None = None,
) -> dict[str, Any]:
    """Score one flow year against a birth chart, optionally including the current da-yun ganzhi."""
    req = YearRequest.model_validate(
        {
            "birth": birth,
            "longitude": longitude,
            "gender": gender,
            "use_true_solar": use_true_solar,
            "late_zi": late_zi,
            "year_ganzhi": year_ganzhi,
            "dayun_ganzhi": dayun_ganzhi,
        }
    )
    c = _build(req)
    ys = _select_yongshen(c, req)
    result = score.score_year(
        c.quad,
        req.year_ganzhi,
        dayun_gz=req.dayun_ganzhi,
        favorable=ys.favorable,
        unfavorable=ys.unfavorable,
    )
    return {
        "engine_version": version("tianzhi-core"),
        "bazi": c.bazi,
        "yongshen": {
            **_plain(ys),
            "favorable": list(ys.favorable),
            "unfavorable": list(ys.unfavorable),
        },
        "year": _plain(result),
    }


security = TransportSecuritySettings(enable_dns_rebinding_protection=False)
mcp_app = mcp.streamable_http_app(
    stateless_http=True,
    json_response=True,
    streamable_http_path="/",
    transport_security=security,
)
app.mount("/mcp", mcp_app)


@app.get("/")
def root() -> dict[str, Any]:
    return {
        "name": "tianzhi-core-api",
        "status": "ok",
        "engine": "tianzhi-core",
        "engine_version": version("tianzhi-core"),
        "docs": "/docs",
        "mcp": "/mcp",
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "engine_version": version("tianzhi-core")}


@app.post("/v1/bazi/chart")
def http_bazi_chart(req: ChartRequest) -> dict[str, Any]:
    try:
        c = _build(req)
        return {"engine_version": version("tianzhi-core"), "chart": c.to_dict()}
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/v1/bazi/analysis")
def http_bazi_analysis(req: ChartRequest) -> dict[str, Any]:
    try:
        c = _build(req)
        return {"engine_version": version("tianzhi-core"), **_analysis(c, req)}
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/v1/bazi/year")
def http_bazi_year(req: YearRequest) -> dict[str, Any]:
    try:
        c = _build(req)
        ys = _select_yongshen(c, req)
        result = score.score_year(
            c.quad,
            req.year_ganzhi,
            dayun_gz=req.dayun_ganzhi,
            favorable=ys.favorable,
            unfavorable=ys.unfavorable,
        )
        return {
            "engine_version": version("tianzhi-core"),
            "bazi": c.bazi,
            "yongshen": {
                **_plain(ys),
                "favorable": list(ys.favorable),
                "unfavorable": list(ys.unfavorable),
            },
            "year": _plain(result),
        }
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
