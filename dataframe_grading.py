import numpy as np
import pandas as pd
from typing import Optional
from grading import GradingResult, determine_mastery_level, generate_feedback_message
from dtw import compute_dtw_similarity
from data_loader import load_sign_from_dataframe


def simple_normalize(pose: np.ndarray) -> np.ndarray:
    """Normalize pose by centering and scaling."""
    centered = pose - pose.mean(axis=(0, 1), keepdims=True)
    scale = np.std(centered)
    if scale > 1e-6:
        centered = centered / scale
    return centered


def grade_sign_from_dataframe(
    reference_df: pd.DataFrame,
    student_df: pd.DataFrame,
    reference_label: str,
    student_label: Optional[str] = None,
    passing_threshold: float = 0.75,
    fps: int = 30,
    downsample_target: int = 10,
    current_mastery_score: float = 0.0,
    times_seen: int = 0,
) -> GradingResult:
    """
    Grade a student sign submission from DataFrame format.

    Args:
        reference_df: Tutor video DataFrame with hand_N_x, hand_N_y, label columns
        student_df: Student submission DataFrame (same format)
        reference_label: Label to extract from reference (e.g., "hello")
        student_label: Label to extract from student (defaults to same as reference)
        passing_threshold: Minimum similarity to pass (0.0-1.0)
        fps: Original frame rate
        downsample_target: Target frame rate after downsampling
        current_mastery_score: Current mastery level (0.0-1.0)
        times_seen: Number of times student has attempted this sign

    Returns:
        GradingResult with similarity score and feedback
    """
    import time

    start = time.time()

    if student_label is None:
        student_label = reference_label

    # Load pose data from DataFrames
    reference_pose = load_sign_from_dataframe(reference_df, reference_label)
    student_pose = load_sign_from_dataframe(student_df, student_label)

    # Normalize poses
    reference_norm = simple_normalize(reference_pose)
    student_norm = simple_normalize(student_pose)

    # Compute DTW similarity
    similarity = compute_dtw_similarity(
        reference_norm,
        student_norm,
        window_pct=0.1,
        fps=fps,
        downsample_target=downsample_target,
    )

    # Determine if correct
    is_correct = similarity >= passing_threshold

    # Generate feedback
    feedback = generate_feedback_message(similarity, is_correct, passing_threshold, [])

    # Determine mastery level
    mastery = determine_mastery_level(similarity, current_mastery_score, times_seen)

    elapsed = (time.time() - start) * 1000

    return GradingResult(
        similarity_score=similarity,
        is_correct=is_correct,
        confidence=0.85,
        feedback_message=feedback,
        mastery_level=mastery,
        reference_frames=len(reference_pose),
        student_frames=len(student_pose),
        processing_time_ms=elapsed,
    )


def batch_grade_from_stream(
    reference_df: pd.DataFrame,
    student_stream_df: pd.DataFrame,
    passing_threshold: float = 0.75,
) -> list[GradingResult]:
    """
    Grade multiple signs from a continuous student recording.

    Args:
        reference_df: Tutor videos with all signs
        student_stream_df: Continuous student recording with label changes
        passing_threshold: Minimum similarity to pass

    Returns:
        List of GradingResults for each detected sign
    """
    from data_loader import split_by_label_changes

    results = []
    segments = split_by_label_changes(student_stream_df)

    for label, segment_df in segments:
        try:
            result = grade_sign_from_dataframe(
                reference_df,
                segment_df.reset_index(drop=True),
                reference_label=label,
                passing_threshold=passing_threshold,
            )
            results.append(result)
        except Exception as e:
            print(f"Error grading sign '{label}': {e}")

    return results
