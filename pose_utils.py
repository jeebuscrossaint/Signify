"""
Utilities for processing MediaPipe pose data for ASL recognition.

MediaPipe provides 33 body landmarks + 21 per hand (left/right) = 75 total,
or just the 33 pose landmarks for body-only tracking.
"""

import numpy as np
from typing import Optional, Union
import cv2


def extract_mediapipe_landmarks(
    landmarks, include_visibility: bool = False
) -> np.ndarray:
    """
    Convert MediaPipe landmarks to numpy array.

    Args:
        landmarks: MediaPipe landmark list
        include_visibility: Whether to include visibility as 4th coordinate

    Returns:
        Array of shape (num_landmarks, 3) or (num_landmarks, 4) if visibility included
    """
    if include_visibility:
        return np.array(
            [[lm.x, lm.y, lm.z, lm.visibility] for lm in landmarks.landmark]
        )
    else:
        return np.array([[lm.x, lm.y, lm.z] for lm in landmarks.landmark])


def normalize_pose_coordinates(pose_array: np.ndarray) -> np.ndarray:
    """
    Normalize pose coordinates to be translation-invariant.

    Centers the pose around the origin using a reference point (e.g., center of shoulders).
    This makes the comparison invariant to where the person is in the frame.

    Args:
        pose_array: Array of shape (num_frames, num_landmarks, 3)

    Returns:
        Normalized pose array
    """
    # MediaPipe pose landmark indices
    # 11 = left shoulder, 12 = right shoulder
    LEFT_SHOULDER = 11
    RIGHT_SHOULDER = 12

    # Use midpoint of shoulders as reference
    if pose_array.shape[1] > max(LEFT_SHOULDER, RIGHT_SHOULDER):
        reference_point = (
            pose_array[:, LEFT_SHOULDER, :] + pose_array[:, RIGHT_SHOULDER, :]
        ) / 2.0
        reference_point = reference_point[:, np.newaxis, :]  # (frames, 1, 3)
    else:
        # Fallback: use mean of all landmarks
        reference_point = pose_array.mean(axis=1, keepdims=True)

    return pose_array - reference_point


def scale_pose_by_body_height(pose_array: np.ndarray) -> np.ndarray:
    """
    Scale pose to be size-invariant.

    Makes comparison work regardless of how far the person is from camera.

    Args:
        pose_array: Array of shape (num_frames, num_landmarks, 3)

    Returns:
        Scale-normalized pose array
    """
    # MediaPipe indices
    NOSE = 0
    LEFT_HIP = 23
    RIGHT_HIP = 24

    if pose_array.shape[1] > max(NOSE, LEFT_HIP, RIGHT_HIP):
        # Approximate height: nose to hip midpoint
        hip_midpoint = (pose_array[:, LEFT_HIP, :] + pose_array[:, RIGHT_HIP, :]) / 2.0
        heights = np.linalg.norm(pose_array[:, NOSE, :] - hip_midpoint, axis=-1)

        # Average height across frames
        avg_height = heights.mean()

        if avg_height > 1e-6:
            return pose_array / avg_height

    return pose_array


def preprocess_pose_sequence(
    pose_array: np.ndarray,
    normalize_translation: bool = True,
    normalize_scale: bool = True,
) -> np.ndarray:
    """
    Full preprocessing pipeline for pose data.

    Args:
        pose_array: Raw pose array (num_frames, num_landmarks, 3)
        normalize_translation: Center pose around reference point
        normalize_scale: Scale by body height

    Returns:
        Preprocessed pose array
    """
    if normalize_translation:
        pose_array = normalize_pose_coordinates(pose_array)

    if normalize_scale:
        pose_array = scale_pose_by_body_height(pose_array)

    return pose_array


def filter_relevant_landmarks(
    pose_array: np.ndarray, landmark_type: str = "upper_body"
) -> tuple[np.ndarray, list[int]]:
    """
    Extract only relevant landmarks for ASL recognition.

    For ASL, you mainly care about face, arms, and hands - not legs.

    Args:
        pose_array: Full pose array (num_frames, 33, 3) for MediaPipe pose
        landmark_type: Which landmarks to keep:
            - "upper_body": Face, shoulders, arms, hands
            - "arms_only": Just arms and hands
            - "full": All landmarks

    Returns:
        Tuple of (filtered_array, indices_kept)
    """
    # MediaPipe Pose landmark indices
    UPPER_BODY_INDICES = [
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,  # Face
        11,
        12,
        13,
        14,
        15,
        16,
        17,
        18,
        19,
        20,
        21,
        22,  # Upper body, arms, hands
    ]

    ARMS_ONLY_INDICES = [
        11,
        12,  # Shoulders
        13,
        14,  # Elbows
        15,
        16,  # Wrists
        17,
        18,
        19,
        20,
        21,
        22,  # Hands
    ]

    if landmark_type == "upper_body":
        indices = UPPER_BODY_INDICES
    elif landmark_type == "arms_only":
        indices = ARMS_ONLY_INDICES
    elif landmark_type == "full":
        return pose_array, list(range(pose_array.shape[1]))
    else:
        raise ValueError(f"Unknown landmark_type: {landmark_type}")

    # Handle case where array doesn't have enough landmarks
    max_idx = max(indices)
    if pose_array.shape[1] <= max_idx:
        return pose_array, list(range(pose_array.shape[1]))

    filtered = pose_array[:, indices, :]
    return filtered, indices


def get_hand_importance_weights(num_landmarks: int = 33) -> np.ndarray:
    """
    Get importance weights that emphasize hands and arms for ASL.

    Args:
        num_landmarks: Total number of landmarks (33 for MediaPipe pose)

    Returns:
        Weight array of shape (num_landmarks,)
    """
    weights = np.ones(num_landmarks)

    if num_landmarks >= 33:
        # MediaPipe Pose indices
        # Wrists, hands, fingers get 3x weight
        HIGH_IMPORTANCE = [15, 16, 17, 18, 19, 20, 21, 22]  # Wrists and hands

        # Elbows and shoulders get 2x weight
        MEDIUM_IMPORTANCE = [11, 12, 13, 14]  # Shoulders and elbows

        for idx in HIGH_IMPORTANCE:
            if idx < num_landmarks:
                weights[idx] = 3.0

        for idx in MEDIUM_IMPORTANCE:
            if idx < num_landmarks:
                weights[idx] = 2.0

    return weights


def validate_pose_quality(
    pose_array: np.ndarray,
    visibility_threshold: float = 0.5,
    min_visible_ratio: float = 0.7,
) -> tuple[bool, str]:
    """
    Check if pose data quality is sufficient for comparison.

    Args:
        pose_array: Pose array, optionally with visibility (num_frames, num_landmarks, 4)
        visibility_threshold: Minimum visibility score per landmark
        min_visible_ratio: Minimum ratio of frames with good visibility

    Returns:
        Tuple of (is_valid, message)
    """
    if pose_array.shape[-1] == 4:
        # Has visibility data
        visibility = pose_array[:, :, 3]

        # Check per-frame visibility
        frame_quality = (visibility > visibility_threshold).mean(axis=1)
        good_frames_ratio = (frame_quality > min_visible_ratio).mean()

        if good_frames_ratio < min_visible_ratio:
            return (
                False,
                f"Poor visibility: only {good_frames_ratio:.1%} of frames are clear",
            )

    # Check for frozen frames (same pose repeated)
    if len(pose_array) > 1:
        frame_diffs = np.diff(pose_array[..., :3], axis=0)  # Only xyz, not visibility
        motion_per_frame = np.linalg.norm(frame_diffs, axis=(1, 2))

        frozen_frames = (motion_per_frame < 1e-4).sum()
        if frozen_frames > len(pose_array) * 0.5:
            return (
                False,
                f"Video appears frozen: {frozen_frames}/{len(pose_array)} static frames",
            )

    return True, "OK"


def interpolate_missing_frames(pose_array: np.ndarray, max_gap: int = 3) -> np.ndarray:
    """
    Interpolate missing/low-quality frames in pose sequence.

    Useful when MediaPipe fails to detect pose in some frames.

    Args:
        pose_array: Pose array with potential NaN values
        max_gap: Maximum gap size to interpolate (frames)

    Returns:
        Interpolated pose array
    """
    # Simple linear interpolation for now
    # For production, consider more sophisticated methods

    if not np.any(np.isnan(pose_array)):
        return pose_array  # No missing data

    num_frames, num_landmarks, num_coords = pose_array.shape
    result = pose_array.copy()

    for landmark_idx in range(num_landmarks):
        for coord_idx in range(num_coords):
            series = pose_array[:, landmark_idx, coord_idx]

            if np.any(np.isnan(series)):
                # Find valid indices
                valid_mask = ~np.isnan(series)
                valid_indices = np.where(valid_mask)[0]

                if len(valid_indices) > 1:
                    # Interpolate
                    result[:, landmark_idx, coord_idx] = np.interp(
                        np.arange(num_frames), valid_indices, series[valid_indices]
                    )

    return result
