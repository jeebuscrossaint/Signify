import numpy as np
from dtaidistance import dtw
from joblib import Parallel, delayed
from typing import Optional, Literal
from zscore import z_normalize_per_joint, weighted_z_normalize


def downsample_sequence(
    sequence: np.ndarray, original_fps: int = 30, target_fps: int = 10
) -> np.ndarray:
    step = original_fps // target_fps
    return sequence[::step]


def single_joint_dtw(
    joint_trajectory_1: np.ndarray,
    joint_trajectory_2: np.ndarray,
    window: Optional[int] = None,
    normalize: bool = True,
) -> float:
    if normalize:
        from zscore import z_normalize

        joint_trajectory_1 = z_normalize(joint_trajectory_1, axis=0)
        joint_trajectory_2 = z_normalize(joint_trajectory_2, axis=0)

    s1 = joint_trajectory_1.flatten()
    s2 = joint_trajectory_2.flatten()

    if window is not None:
        distance = dtw.distance_fast(s1, s2, window=window)
    else:
        distance = dtw.distance_fast(s1, s2)

    return distance


def parallel_joint_dtw(
    pose_1: np.ndarray,
    pose_2: np.ndarray,
    window_pct: float = 0.1,
    joint_weights: Optional[np.ndarray] = None,
    n_jobs: int = -1,
    normalize: bool = True,
) -> tuple[float, np.ndarray]:
    num_frames = max(pose_1.shape[0], pose_2.shape[0])
    num_joints = pose_1.shape[1]
    window = max(1, int(num_frames * window_pct))

    # Use weighted normalization if no weights provided
    if joint_weights is None and normalize:
        pose_1, joint_weights = weighted_z_normalize(pose_1)
        pose_2, _ = weighted_z_normalize(pose_2)
    elif normalize:
        pose_1 = z_normalize_per_joint(pose_1)
        pose_2 = z_normalize_per_joint(pose_2)
        joint_weights = joint_weights / joint_weights.sum()  # Normalize weights
    else:
        if joint_weights is None:
            joint_weights = np.ones(num_joints) / num_joints
        else:
            joint_weights = joint_weights / joint_weights.sum()

    # Compute DTW for each joint in parallel
    distances = Parallel(n_jobs=n_jobs)(
        delayed(single_joint_dtw)(
            pose_1[:, j, :],
            pose_2[:, j, :],
            window=window,
            normalize=False,  # Already normalized above
        )
        for j in range(num_joints)
    )

    distances = np.array(distances)

    # Weighted average of per-joint distances
    weighted_distance = np.sum(joint_weights * distances)

    return weighted_distance, distances


def compute_dtw_similarity(
    pose_1: np.ndarray,
    pose_2: np.ndarray,
    window_pct: float = 0.1,
    joint_weights: Optional[np.ndarray] = None,
    fps: int = 30,
    downsample_target: int = 10,
    metric: Literal["distance", "similarity"] = "similarity",
) -> float:
    if downsample_target and downsample_target < fps:
        pose_1 = downsample_sequence(pose_1, fps, downsample_target)
        pose_2 = downsample_sequence(pose_2, fps, downsample_target)

    distance, _ = parallel_joint_dtw(
        pose_1,
        pose_2,
        window_pct=window_pct,
        joint_weights=joint_weights,
        normalize=True,
    )

    if metric == "distance":
        return distance

    scale = 15.0
    similarity = np.exp(-distance / scale)

    return float(np.clip(similarity, 0.0, 1.0))


def batch_compare(
    reference_pose: np.ndarray,
    student_poses: list[np.ndarray],
    window_pct: float = 0.1,
    joint_weights: Optional[np.ndarray] = None,
    fps: int = 30,
    downsample_target: int = 10,
) -> list[float]:
    if downsample_target and downsample_target < fps:
        reference_pose = downsample_sequence(reference_pose, fps, downsample_target)

    scores = []
    for student_pose in student_poses:
        score = compute_dtw_similarity(
            reference_pose,
            student_pose,
            window_pct=window_pct,
            joint_weights=joint_weights,
            fps=fps,
            downsample_target=downsample_target,
        )
        scores.append(score)

    return scores


def get_recommended_window(
    pose_1: np.ndarray,
    pose_2: np.ndarray,
    base_window_pct: float = 0.1,
    max_window_pct: float = 0.5,
) -> float:
    from zscore import compute_motion_speed

    speed1 = compute_motion_speed(pose_1)
    speed2 = compute_motion_speed(pose_2)

    if speed2 < 1e-8:
        return max_window_pct

    ratio = max(speed1, speed2) / (min(speed1, speed2) + 1e-8)
    recommended = min(base_window_pct * ratio, max_window_pct)

    return recommended


def adaptive_dtw_similarity(
    pose_1: np.ndarray,
    pose_2: np.ndarray,
    joint_weights: Optional[np.ndarray] = None,
    fps: int = 30,
    downsample_target: int = 10,
) -> tuple[float, dict]:
    if downsample_target and downsample_target < fps:
        pose_1_ds = downsample_sequence(pose_1, fps, downsample_target)
        pose_2_ds = downsample_sequence(pose_2, fps, downsample_target)
    else:
        pose_1_ds = pose_1
        pose_2_ds = pose_2

    window_pct = get_recommended_window(pose_1_ds, pose_2_ds)

    similarity = compute_dtw_similarity(
        pose_1,
        pose_2,
        window_pct=window_pct,
        joint_weights=joint_weights,
        fps=fps,
        downsample_target=downsample_target,
    )

    metadata = {
        "window_pct": window_pct,
        "frames_reference": len(pose_1),
        "frames_student": len(pose_2),
        "downsampled_frames": len(pose_1_ds),
    }

    return similarity, metadata
