import numpy as np
from typing import Optional


def z_normalize(
    sequence: np.ndarray, axis: int = 0, epsilon: float = 1e-8
) -> np.ndarray:
    mean = sequence.mean(axis=axis, keepdims=True)
    std = sequence.std(axis=axis, keepdims=True)
    std = np.where(std < epsilon, 1.0, std)
    return (sequence - mean) / std


def z_normalize_per_joint(
    pose_sequence: np.ndarray, epsilon: float = 1e-8
) -> np.ndarray:
    # pose_sequence: (frames, joints, coords)
    num_frames, num_joints, num_coords = pose_sequence.shape
    normalized = np.zeros_like(pose_sequence)

    for j in range(num_joints):
        normalized[:, j, :] = z_normalize(
            pose_sequence[:, j, :], axis=0, epsilon=epsilon
        )

    return normalized


def compute_motion_speed(pose_sequence: np.ndarray) -> float:
    if len(pose_sequence) < 2:
        return 0.0
    diffs = np.diff(pose_sequence, axis=0)
    displacements = np.linalg.norm(diffs, axis=-1)
    return float(np.mean(displacements))


def detect_static_joints(
    pose_sequence: np.ndarray, threshold: float = 1e-3
) -> np.ndarray:
    if len(pose_sequence) < 2:
        return np.ones(pose_sequence.shape[1], dtype=bool)
    diffs = np.diff(pose_sequence, axis=0)
    displacements = np.linalg.norm(diffs, axis=-1)
    avg_motion = displacements.mean(axis=0)
    return avg_motion < threshold


def weighted_z_normalize(
    pose_sequence: np.ndarray,
    joint_weights: Optional[np.ndarray] = None,
    epsilon: float = 1e-8,
) -> tuple[np.ndarray, np.ndarray]:
    num_frames, num_joints, num_coords = pose_sequence.shape
    static_mask = detect_static_joints(pose_sequence)

    if joint_weights is None:
        joint_weights = np.ones(num_joints)

    joint_weights = joint_weights.copy()
    joint_weights[static_mask] *= 0.1
    joint_weights = joint_weights / joint_weights.sum()

    normalized = z_normalize_per_joint(pose_sequence, epsilon=epsilon)
    return normalized, joint_weights
