import numpy as np
import pandas as pd
from typing import Dict, List, Tuple


def load_sign_from_dataframe(df: pd.DataFrame, label: str) -> np.ndarray:
    """
    Extract a single sign from DataFrame and convert to numpy array.

    Args:
        df: DataFrame with columns hand_0_x, hand_0_y, ..., hand_34_x, hand_34_y, label
        label: The sign label to filter for (e.g., "hello", "thank you")

    Returns:
        numpy array of shape (frames, 35, 2) where:
        - frames: number of timesteps for this sign
        - 35: number of joints (hand_0 through hand_34)
        - 2: x and y coordinates
    """
    sign_data = df[df["label"] == label].copy()

    if len(sign_data) == 0:
        raise ValueError(f"No data found for label '{label}'")

    frames = len(sign_data)
    pose_data = np.zeros((frames, 35, 2))

    for joint_idx in range(35):
        x_col = f"hand_{joint_idx}_x"
        y_col = f"hand_{joint_idx}_y"

        if x_col not in sign_data.columns or y_col not in sign_data.columns:
            raise ValueError(f"Missing columns for joint {joint_idx}: {x_col}, {y_col}")

        pose_data[:, joint_idx, 0] = sign_data[x_col].values
        pose_data[:, joint_idx, 1] = sign_data[y_col].values

    return pose_data


def load_all_signs(df: pd.DataFrame) -> Dict[str, np.ndarray]:
    """
    Load all unique signs from DataFrame.

    Args:
        df: DataFrame with pose data and labels

    Returns:
        Dictionary mapping label -> pose array (frames, 35, 2)
    """
    labels = df["label"].unique()
    labels = [l for l in labels if l != 0 and l != "0"]  # Filter out separator labels

    signs = {}
    for label in labels:
        try:
            signs[label] = load_sign_from_dataframe(df, label)
        except Exception as e:
            print(f"Warning: Could not load sign '{label}': {e}")

    return signs


def stream_to_dataframe(stream_data: List[Dict]) -> pd.DataFrame:
    """
    Convert streaming data to DataFrame format.

    Args:
        stream_data: List of dicts with keys: hand_0_x, hand_0_y, ..., hand_34_x, hand_34_y, label

    Returns:
        DataFrame ready for processing
    """
    return pd.DataFrame(stream_data)


def split_by_label_changes(df: pd.DataFrame) -> List[Tuple[str, pd.DataFrame]]:
    """
    Split DataFrame into segments whenever label changes.
    Useful for processing continuous recording with multiple signs.

    Args:
        df: DataFrame with label column

    Returns:
        List of (label, segment_df) tuples
    """
    segments = []

    if len(df) == 0:
        return segments

    current_label = df.iloc[0]["label"]
    start_idx = 0

    for i in range(1, len(df)):
        if df.iloc[i]["label"] != current_label:
            if current_label != 0 and current_label != "0":
                segments.append((current_label, df.iloc[start_idx:i]))
            current_label = df.iloc[i]["label"]
            start_idx = i

    # Add last segment
    if current_label != 0 and current_label != "0":
        segments.append((current_label, df.iloc[start_idx:]))

    return segments


def create_example_data(num_frames: int = 50, label: str = "hello") -> pd.DataFrame:
    """
    Generate example DataFrame data for testing.

    Args:
        num_frames: Number of frames to generate
        label: Label for the sign

    Returns:
        DataFrame with synthetic pose data
    """
    data = {"label": [label] * num_frames}

    t = np.linspace(0, 2 * np.pi, num_frames)

    for joint_idx in range(35):
        phase = joint_idx * 0.1
        data[f"hand_{joint_idx}_x"] = (
            np.sin(t + phase) * 0.5 + np.random.randn(num_frames) * 0.01
        )
        data[f"hand_{joint_idx}_y"] = (
            np.cos(t * 0.5 + phase) * 0.3 + np.random.randn(num_frames) * 0.01
        )

    return pd.DataFrame(data)
