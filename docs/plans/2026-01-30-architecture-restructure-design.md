# Architecture Restructure Design

## Problem

PathTracer is structurally treated as an add-on rather than a core component of First Aid Kit. The backend directory layout and naming are inconsistent:

| Directory | What it actually is | Name suggests |
|-----------|-------------------|---------------|
| `api/` | Path Tracer's Flask backend | "The API" (generic) |
| `backend/` | iPerf's Go backend | "The Backend" (generic) |
| `pathtracer/` | Python module imported by `api/` | A standalone tool |

Problems:
- `api/` and `backend/` are meaningless names — you must read the code to know which serves which tool.
- `pathtracer/` looks standalone but is actually a library imported by `api/` via `sys.path` hackery.
- Docker service names follow the same pattern: `backend` for traceroute, `iperf-backend` for iPerf.
- nginx routes compound this: `/api/` goes to traceroute, `/iperf/api/` goes to iPerf — PathTracer owns the "default" namespace.

## Design

### Directory restructure

**Current:**
```
fak/
├── api/                  # Flask backend (traceroute + pathtracer)
├── backend/              # Go backend (iPerf)
├── pathtracer/           # Python library (imported by api/)
├── src/                  # React frontend
├── Dockerfile            # Frontend
├── docker-compose.yml
└── nginx.conf
```

**Proposed:**
```
fak/
├── services/
│   ├── pathtrace-api/    # Flask backend + pathtracer module merged
│   │   ├── Dockerfile
│   │   ├── requirements.txt  # merged: flask + netmiko + paramiko
│   │   ├── traceroute.py
│   │   └── pathtracer/       # moved inside its own service
│   │       ├── orchestrator.py
│   │       ├── drivers/
│   │       └── parsers/
│   └── iperf-api/        # Go backend (renamed)
│       ├── Dockerfile
│       ├── cmd/
│       ├── internal/
│       └── go.mod
├── src/                  # React frontend (unchanged)
├── Dockerfile            # Frontend (unchanged)
├── docker-compose.yml    # service names updated
└── nginx.conf            # proxy names updated
```

### Key changes

- **`services/` parent directory** groups all backends as peer services.
- **`pathtrace-api/`** merges `api/` and `pathtracer/` into one directory, eliminating the `sys.path` hack.
- **`iperf-api/`** renamed from `backend/` to match the pattern.
- **Docker service names** become `pathtrace-api` and `iperf-api` — symmetric and self-documenting.
- **nginx proxy paths** become `/pathtrace/api/` and `/iperf/api/` — both namespaced equally.
- **Two `requirements.txt` merge** into one inside `pathtrace-api/`.
- **PathTracer does not need standalone operation** — it only runs as part of First Aid Kit.

### What stays the same

- All React components, routing, and types in `src/` (only fetch URL changes in `PathTracer/index.tsx`).
- All backend logic — files move, code doesn't change (except removing `sys.path` hack and updating Dockerfile).
- iPerf Go code — moves directory, zero code changes.

### Full change list

| Change | Type |
|--------|------|
| Move `api/` to `services/pathtrace-api/` | File move |
| Move `pathtracer/` to `services/pathtrace-api/pathtracer/` | File move |
| Move `backend/` to `services/iperf-api/` | File move |
| Merge two `requirements.txt` into one | File merge |
| Remove `sys.path` hack from `traceroute.py` | Code fix |
| Simplify `pathtrace-api/Dockerfile` | Config update |
| Update `docker-compose.yml` service names + build paths | Config update |
| Update `nginx.conf` proxy paths + upstream names | Config update |
| Update fetch URL in `PathTracer/index.tsx` | Code fix |
| Update `.gitignore` paths | Config update |
| Update `start.sh` if any hardcoded paths | Config update |
| Update docs referencing old paths | Doc update |
