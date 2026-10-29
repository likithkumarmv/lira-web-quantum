"""LAB_FIXTURE chains for the PNR demo (Indian drayage, JNPT). Calendars are illustrative, not official schedules."""
from datetime import date, datetime, time, timedelta
from pnr_engine import IST, Calendar, ContainerChain, Step, Window

WEEKDAYS = (0, 1, 2, 3, 4, 5)
BANK_SAME_DAY = Calendar("bank same-day reconciliation (10:00-13:30)", [Window(time(10, 0), time(13, 30), WEEKDAYS)])
CARRIER_DESK = Calendar("carrier e-DO desk (09:30-13:00, 14:00-17:00)",
                        [Window(time(9, 30), time(13, 0), WEEKDAYS), Window(time(14, 0), time(17, 0), WEEKDAYS)])
HEAVY_VEHICLE = Calendar("heavy-vehicle road window (no 08:00-11:00 / 17:00-21:00)",
                         [Window(time(0, 0), time(8, 0)), Window(time(11, 0), time(17, 0)), Window(time(21, 0), time(23, 59, 59))])
YARD = Calendar("chassis yard (06:00-22:00)", [Window(time(6, 0), time(22, 0))])
DEPOT = Calendar("empty depot gate (08:00-18:00)", [Window(time(8, 0), time(18, 0), WEEKDAYS)])
ALWAYS = Calendar.always("24x7")


def demo_day() -> date:
    return date(2026, 10, 29)       # Thursday


def at(h, m, d=None):
    return datetime.combine(d or demo_day(), time(h, m), IST)


def chain_c2_edo() -> ContainerChain:
    """HLCU9201940: UTR paid but e-DO not released. Looks like '5h35m left' at 10:25. Real PNR 10:35."""
    return ContainerChain("HLCU9201940", at(16, 0), "DPD_FREE_TIME", [
        Step("pay", "RTGS UTR reconciliation", "FORWARDER_AP_DESK", 60, BANK_SAME_DAY, [], p10_min=45, p90_min=90,
             evidence_ref="Hapag-Lloyd DO payment notice (EML)"),
        Step("edo", "e-DO release by carrier", "CARRIER_FINANCE", 45, CARRIER_DESK, ["pay"], p10_min=30, p90_min=90),
        Step("slot", "Terminal slot booking (120 min lead)", "CHA", 120, ALWAYS, ["edo"]),
        Step("dispatch", "Truck dispatch", "CARRIER_DISPATCH", 20, ALWAYS, ["slot"], p10_min=15, p90_min=40),
        Step("travel", "Travel to JNPT gate (NH-348)", "DRIVER", 50, HEAVY_VEHICLE, ["dispatch"], p10_min=40, p90_min=90),
        Step("gate", "Gate-out processing", "TERMINAL", 30, ALWAYS, ["travel"], p10_min=20, p90_min=45),
    ], penalty_per_day_inr=10000, fixed_penalty_inr=14500)


def chain_c5_breakdown() -> ContainerChain:
    """MSCU6619200: T07 broke down; replacement T09 must be confirmed, pick chassis, reach gate."""
    return ContainerChain("MSCU6619200", at(16, 0), "DPD_FREE_TIME", [
        Step("confirm", "Confirm backup driver (Bolna call)", "CARRIER_DISPATCH", 15, ALWAYS, [], p10_min=5, p90_min=40),
        Step("chassis", "Pick chassis R-03 at yard", "YARD_MARSHAL", 25, YARD, ["confirm"], p10_min=15, p90_min=45),
        Step("travel", "Travel to JNPT gate", "DRIVER", 50, HEAVY_VEHICLE, ["chassis"], p10_min=40, p90_min=90),
        Step("gate", "Gate-out processing", "TERMINAL", 30, ALWAYS, ["travel"], p10_min=20, p90_min=45),
    ], penalty_per_day_inr=10000, fixed_penalty_inr=14500)


def chain_c6_empty() -> ContainerChain:
    """ONEU5519206: empty must be back at an accepting depot before detention starts."""
    return ContainerChain("ONEU5519206", at(18, 0), "DETENTION", [
        Step("depot_ok", "Confirm alternate depot acceptance", "DEPOT_CONTROLLER", 30, DEPOT, [], p10_min=15, p90_min=60),
        Step("travel", "Haul empty to depot", "DRIVER", 60, HEAVY_VEHICLE, ["depot_ok"], p10_min=45, p90_min=100),
        Step("gate_in", "Depot gate-in + EIR", "DEPOT", 30, DEPOT, ["travel"], p10_min=20, p90_min=45),
    ], penalty_per_day_inr=14000)


def all_chains():
    return [chain_c2_edo(), chain_c5_breakdown(), chain_c6_empty()]
