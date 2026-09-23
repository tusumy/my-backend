# Tianzhi Core API

A small FastAPI wrapper around [`tianzhi-core`](https://github.com/zaoxu001/tianzhi-core).

## What it exposes

- `GET /health` — health/version check
- `POST /v1/bazi/chart` — deterministic BaZi chart
- `POST /v1/bazi/analysis` — chart + strength + element power + ten-god power + climate + pattern + tiaohou + yongshen
- `POST /v1/bazi/year` — score one flow year using the chart's selected favorable/unfavorable elements
- `GET /docs` — interactive OpenAPI docs

## Request shape

```json
{
  "birth": "1996-04-18T14:06:00",
  "longitude": 114.93,
  "gender": 0,
  "use_true_solar": true,
  "late_zi": "next_day"
}
```

`gender`: `0` male, `1` female, following tianzhi-core's API.

Important: tianzhi-core treats a timezone-naive datetime as China Standard Time. If you send an offset-aware timestamp, it is normalized by the engine before calculation.

For `/v1/bazi/year`, add:

```json
{
  "year_ganzhi": "丙午",
  "dayun_ganzhi": "甲午"
}
```

`dayun_ganzhi` is optional.

## Local run

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Then open `http://localhost:8000/docs`.

## Docker

```bash
docker build -t tianzhi-core-api .
docker run --rm -p 8000:10000 tianzhi-core-api
```

## Render

Use this repository with **Root Directory** set to:

```text
tianzhi-service
```

Choose the Docker runtime. No secrets are required by this service.

## Design

This wrapper does not ask an LLM to calculate the chart. `tianzhi-core` performs the deterministic calculation and returns structured data; an AI/client can interpret the returned fields separately.
