# LIRA Point-of-No-Return (PNR) engine

"Everyone tracks the deadline. Nobody tracks the moment the deadline became unavoidable."

## Files
- `pnr_engine.py`: the engine (backward and forward passes with calendar snapping, uncertainty, orphaned actions, QpiAI triage model)
- `pnr_fixtures.py`: Indian drayage demo chains (LAB_FIXTURE): C2 e-DO, C5 breakdown, C6 empty return
- `pnr_router.py`: FastAPI endpoints `/api/v1/pnr/containers`, `/containers/{no}`, `/triage`
- `test_pnr.py`: 7 tests, including a brute-force check that the QpiAI QUBO's minimum is a feasible assignment
- `demo_pnr.py`: prints the judge story. Set QPIAI_OPT_API_KEY to also run the real QpiAI solve.

## Run
pip install "qpiai-opt[quantum]" pytest
python -m pytest -q test_pnr.py
python demo_pnr.py
