#!/usr/bin/env python3
import argparse
import pickle
from pathlib import Path

import numpy as np
import pandas as pd


SENSOR_NAMES = [
    "bendDieLatT", "bendDieRotT", "bendDieVerT",
    "bendDieLatM", "bendDieRotA", "bendDieVerM",
    "colletAxT", "colletRotT", "colletAxMov", "colletRotMov",
    "mandrelAxLoad", "mandrelAxMov",
    "pressAxT", "pressLatT", "pressLeftAxT",
    "pressAxMov", "pressLatMov", "pressLeftAxMov",
    "clampLatT", "clampLatMov"
]

MAP_LOADS = {
    "bendDieLatT": "MACHINE_BEND-DIE_LATERAL_Max_Torque_[%]",
    "bendDieRotT": "MACHINE_BEND-DIE_ROTATING_Max_Torque_[%]",
    "bendDieVerT": "MACHINE_BEND-DIE_VERTICAL_Max_Torque_[%]",
    "clampLatT": "MACHINE_CLAMP-DIE_LATERAL_Max_Torque_[%]",
    "colletAxT": "MACHINE_COLLET_AXIAL_Max_Torque_[%]",
    "colletRotT": "MACHINE_COLLET_ROTATING_Max_Torque_[%]",
    "mandrelAxLoad": "MACHINE_MANDREL_AXIAL_Max_Torque_[%]",
    "pressAxT": "MACHINE_PRESSURE-DIE_AXIAL_Max_Torque_[%]",
    "pressLatT": "MACHINE_PRESSURE-DIE_LATERAL_Max_Torque_[%]",
    "pressLeftAxT": "MACHINE_PRESSURE-DIE_LEFT_AXIAL_Max_Torque_[%]",
}

MAP_MOVES = {
    "bendDieLatM": "BEND-DIE_LATERAL_Movement_[mm]",
    "bendDieRotA": "BEND-DIE_ROTATING_Angle_[°]",
    "bendDieVerM": "BEND-DIE_VERTICAL_Movement_[mm]",
    "clampLatMov": "CLAMP-DIE_LATERAL_Movement_[mm]",
    "colletAxMov": "COLLET_AXIAL_Movement_[mm]",
    "colletRotMov": "COLLET_ROTATING_Movement_[mm]",
    "mandrelAxMov": "MANDREL_AXIAL_Movement_[mm]",
    "pressAxMov": "PRESSURE-DIE_AXIAL_Movement_[mm]",
    "pressLatMov": "PRESSURE-DIE_LATERAL_Movement_[mm]",
    "pressLeftAxMov": "PRESSURE-DIE_LEFT_AXIAL_Movement_[mm]",
}


def js_escape(s: str) -> str:
    return s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")


def get_time_vector(df: pd.DataFrame) -> np.ndarray:
    """
    Return numeric time vector. Prefer a Time column, then numeric index, else range.
    """
    time_cols = [c for c in df.columns if "time" in str(c).lower()]
    if time_cols:
        t = pd.to_numeric(df[time_cols[0]], errors="coerce").to_numpy(dtype=float)
        if np.isfinite(t).sum() >= 2:
            return t

    try:
        idx = pd.to_numeric(df.index, errors="coerce").to_numpy(dtype=float)
        if np.isfinite(idx).sum() >= 2:
            return idx
    except Exception:
        pass

    return np.arange(len(df), dtype=float)


def clean_xy(t: np.ndarray, y: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    t = np.asarray(t, dtype=float)
    y = np.asarray(y, dtype=float)

    mask = np.isfinite(t) & np.isfinite(y)
    t = t[mask]
    y = y[mask]

    if t.size == 0:
        return np.array([], dtype=float), np.array([], dtype=float)

    order = np.argsort(t)
    t = t[order]
    y = y[order]

    # remove duplicate time values
    t_unique, idx = np.unique(t, return_index=True)
    y_unique = y[idx]

    return t_unique, y_unique


def resample_series(t: np.ndarray, y: np.ndarray, n: int) -> tuple[np.ndarray, np.ndarray]:
    """
    Resample to n points. Returns:
      - resampled time vector in original units
      - resampled signal
    """
    t, y = clean_xy(t, y)

    if t.size < 2:
        new_t = np.linspace(0.0, 1.0, n)
        return new_t, np.zeros(n, dtype=float)

    t0, t1 = t[0], t[-1]
    if t1 == t0:
        new_t = np.linspace(t0, t1, n)
        return new_t, np.full(n, y[0], dtype=float)

    new_t = np.linspace(t0, t1, n)
    new_y = np.interp(new_t, t, y)
    return new_t, new_y


def quantize_and_offset(raw_sensors: np.ndarray, quant: int = 100) -> np.ndarray:
    """
    Produce old-style stacked/quantized arrays so the current legacy viz.js
    still has something usable.
    """
    sensors = np.nan_to_num(raw_sensors.copy(), nan=0.0)

    num_channels, _ = sensors.shape
    mins = np.nanmin(sensors, axis=1)
    maxs = np.nanmax(sensors, axis=1)

    TORQ_CHANNELS = {0, 1, 2, 6, 7, 10, 12, 13, 14, 18}
    DIST_CHANNELS = {3, 4, 5, 8, 9, 11, 15, 16, 17, 19}

    tmin = np.nanmin([mins[i] for i in TORQ_CHANNELS])
    tmax = np.nanmax([maxs[i] for i in TORQ_CHANNELS])
    dmin = np.nanmin([mins[i] for i in DIST_CHANNELS])
    dmax = np.nanmax([maxs[i] for i in DIST_CHANNELS])

    tspan = (tmax - tmin) if (tmax - tmin) != 0 else 1.0
    dspan = (dmax - dmin) if (dmax - dmin) != 0 else 1.0

    out = np.zeros_like(sensors, dtype=int)

    for ch in range(num_channels):
        arr = sensors[ch]

        if ch in TORQ_CHANNELS:
            q = quant * (((arr - tmin) / tspan) - 0.5)
        elif ch in DIST_CHANNELS:
            q = quant * (((arr - dmin) / dspan) - 0.5)
        else:
            span = (maxs[ch] - mins[ch]) if (maxs[ch] - mins[ch]) != 0 else 1.0
            q = quant * (((arr - mins[ch]) / span) - 0.5)

        if ch < 3:
            q += 450
        elif ch < 6:
            q += 400
        elif ch < 10:
            q += 300
        elif ch < 12:
            q += 220
        elif ch < 18:
            q += 100

        out[ch] = np.round(q).astype(int)

    return out


def build_experiment(exp: dict, exp_id: int, n_samples: int):
    dfL = exp["process_parameters_loads_machine"]
    dfM = exp["process_parameters_movements"]

    tL = get_time_vector(dfL)
    tM = get_time_vector(dfM)

    # Use movement time as master time if available, else loads
    _, master_time = None, None
    if np.isfinite(tM).sum() >= 2:
        master_time, _dummy = resample_series(tM, np.zeros(len(tM)), n_samples)
    else:
        master_time, _dummy = resample_series(tL, np.zeros(len(tL)), n_samples)

    raw_sensors = np.zeros((len(SENSOR_NAMES), n_samples), dtype=float)

    # Loads
    for sensor, col in MAP_LOADS.items():
        if col in dfL.columns:
            y = pd.to_numeric(dfL[col], errors="coerce").to_numpy(dtype=float)
            _, new_y = resample_series(tL, y, n_samples)
            raw_sensors[SENSOR_NAMES.index(sensor), :] = new_y

    # Movements
    for sensor, col in MAP_MOVES.items():
        if col in dfM.columns:
            y = pd.to_numeric(dfM[col], errors="coerce").to_numpy(dtype=float)
            _, new_y = resample_series(tM, y, n_samples)
            raw_sensors[SENSOR_NAMES.index(sensor), :] = new_y

    q_sensors = quantize_and_offset(raw_sensors, quant=100)

    duration = float(master_time[-1] - master_time[0]) if len(master_time) > 1 else 0.0
    info = (
        f"Experiment: {exp_id}\n"
        f"Samples (resampled): {n_samples}\n"
        f"Duration [s]: {duration:.4f}\n"
        f"Source: TubeBEND"
    )

    return master_time, raw_sensors, q_sensors, info


def write_js(out_path: Path, time: np.ndarray, raw_sensors: np.ndarray, q_sensors: np.ndarray, info: str):
    with out_path.open("w") as f:
        # Real time axis for future frontend
        f.write("var time=[")
        f.write(",".join(f"{x:.10g}" for x in time))
        f.write("];\n")

        # Also keep ids for backwards compatibility if anything still references sample index
        f.write("var ids=[")
        f.write(",".join(str(i) for i in range(len(time))))
        f.write("];\n")

        # Raw arrays for future normalized plotting + hover actual values
        for i, name in enumerate(SENSOR_NAMES):
            arr = raw_sensors[i]
            f.write(f"var {name}_raw=[")
            f.write(",".join(f"{x:.10g}" for x in arr))
            f.write("];\n")

        # Quantized arrays for current legacy stacked plot
        for i, name in enumerate(SENSOR_NAMES):
            arr = q_sensors[i]
            f.write(f"var {name}=[")
            f.write(",".join(str(int(x)) for x in arr))
            f.write("];\n")

        f.write(f"var info='{js_escape(info)}';\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pkl", required=True, help="Path to experiments_process_and_results.pkl")
    ap.add_argument("--out-dir", required=True, help="Output directory for dta<id>.js")
    ap.add_argument("--n-samples", type=int, default=2000)
    ap.add_argument("--start", type=int, default=1)
    ap.add_argument("--end", type=int, default=318)
    args = ap.parse_args()

    pkl_path = Path(args.pkl)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    with pkl_path.open("rb") as f:
        data = pickle.load(f)

    for exp_id in range(args.start, args.end + 1):
        key = f"Exp_{exp_id}"
        if key not in data:
            print(f"SKIP: {key} not found")
            continue

        time, raw_sensors, q_sensors, info = build_experiment(data[key], exp_id, args.n_samples)
        out_path = out_dir / f"dta{exp_id}.js"
        write_js(out_path, time, raw_sensors, q_sensors, info)

        if exp_id % 25 == 0:
            print(f"Done up to Exp_{exp_id}")

    print("Finished generating dta files.")


if __name__ == "__main__":
    main()