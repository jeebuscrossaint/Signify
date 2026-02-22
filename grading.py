import numpy as np
from typing import Optional, Literal
from dataclasses import dataclass

from dtw import compute_dtw_similarity, adaptive_dtw_similarity
from pose_utils import (
    preprocess_pose_sequence,
    filter_relevant_landmarks,
    get_hand_importance_weights,
    validate_pose_quality,
)


@dataclass
class GradingResult:
    similarity_score: float
    is_correct: bool
    confidence: float
    feedback_message: str
    mastery_level: Literal["new", "learning", "mastered"]
    reference_frames: int
    student_frames: int
    processing_time_ms: float
    per_joint_scores: Optional[np.ndarray] = None
    quality_issues: Optional[list[str]] = None


def grade_sign_submission(
    reference_pose: np.ndarray,
    student_pose: np.ndarray,
    passing_threshold: float = 0.75,
    fps: int = 30,
    downsample_target: int = 10,
    use_adaptive_window: bool = True,
    landmark_filter: str = "upper_body",
    current_mastery_score: float = 0.0,
    times_seen: int = 0,
) -> GradingResult:
    import time

    start_time = time.time()

    quality_issues = []

    # Validate input quality
    ref_valid, ref_msg = validate_pose_quality(reference_pose)
    if not ref_valid:
        quality_issues.append(f"Reference: {ref_msg}")

    student_valid, student_msg = validate_pose_quality(student_pose)
    if not student_valid:
        quality_issues.append(f"Student: {student_msg}")

    # If student video is really bad, fail immediately
    if not student_valid and "frozen" in student_msg.lower():
        return GradingResult(
            similarity_score=0.0,
            is_correct=False,
            confidence=0.9,
            feedback_message="Video appears frozen or person not visible. Please try again.",
            mastery_level=determine_mastery_level(
                0.0, current_mastery_score, times_seen
            ),
            reference_frames=len(reference_pose),
            student_frames=len(student_pose),
            processing_time_ms=(time.time() - start_time) * 1000,
            quality_issues=quality_issues,
        )

    # Extract only xyz coordinates (drop visibility if present)
    reference_xyz = reference_pose[..., :3]
    student_xyz = student_pose[..., :3]

    # Preprocess: normalize translation and scale
    reference_processed = preprocess_pose_sequence(reference_xyz)
    student_processed = preprocess_pose_sequence(student_xyz)

    # Filter to relevant landmarks
    reference_filtered, indices = filter_relevant_landmarks(
        reference_processed, landmark_type=landmark_filter
    )
    student_filtered, _ = filter_relevant_landmarks(
        student_processed, landmark_type=landmark_filter
    )

    # Get importance weights emphasizing hands/arms
    num_joints = reference_filtered.shape[1]
    weights = get_hand_importance_weights(num_joints)

    # Compute similarity
    if use_adaptive_window:
        similarity, metadata = adaptive_dtw_similarity(
            reference_filtered,
            student_filtered,
            joint_weights=weights,
            fps=fps,
            downsample_target=downsample_target,
        )
    else:
        similarity = compute_dtw_similarity(
            reference_filtered,
            student_filtered,
            window_pct=0.1,
            joint_weights=weights,
            fps=fps,
            downsample_target=downsample_target,
        )
        metadata = {}

    # Determine if correct
    is_correct = similarity >= passing_threshold

    # Compute confidence based on how clear the result is
    # High confidence if score is far from threshold (either way)
    distance_from_threshold = abs(similarity - passing_threshold)
    confidence = min(0.5 + distance_from_threshold * 2, 1.0)

    # Generate feedback message
    feedback = generate_feedback_message(
        similarity, is_correct, passing_threshold, quality_issues
    )

    # Determine mastery level
    new_mastery = update_mastery_score(current_mastery_score, is_correct, times_seen)
    mastery_level = determine_mastery_level(similarity, new_mastery, times_seen + 1)

    processing_time = (time.time() - start_time) * 1000

    return GradingResult(
        similarity_score=similarity,
        is_correct=is_correct,
        confidence=confidence,
        feedback_message=feedback,
        mastery_level=mastery_level,
        reference_frames=len(reference_pose),
        student_frames=len(student_pose),
        processing_time_ms=processing_time,
        quality_issues=quality_issues if quality_issues else None,
    )


def generate_feedback_message(
    similarity: float, is_correct: bool, threshold: float, quality_issues: list[str]
) -> str:
    if quality_issues:
        quality_note = " Note: " + "; ".join(quality_issues)
    else:
        quality_note = ""

    if similarity >= 0.95:
        return f"Perfect! Excellent execution.{quality_note}"
    elif similarity >= 0.85:
        return f"Great job! Very accurate.{quality_note}"
    elif similarity >= threshold:
        return f"Good work! You got it right.{quality_note}"
    elif similarity >= threshold - 0.1:
        return f"Close! Try again - pay attention to hand position and movement.{quality_note}"
    elif similarity >= threshold - 0.2:
        return f"Not quite right. Review the demo video and try again.{quality_note}"
    else:
        return f"That doesn't match the sign. Watch the demo carefully and try again.{quality_note}"


def update_mastery_score(
    current_score: float, was_correct: bool, times_seen: int, learning_rate: float = 0.2
) -> float:
    if times_seen == 0:
        return 1.0 if was_correct else 0.0

    target = 1.0 if was_correct else 0.0
    new_score = current_score * (1 - learning_rate) + target * learning_rate

    return float(np.clip(new_score, 0.0, 1.0))


def determine_mastery_level(
    similarity: float, mastery_score: float, times_seen: int
) -> Literal["new", "learning", "mastered"]:
    if times_seen == 0:
        return "new"
    if mastery_score >= 0.8 and times_seen >= 5:
        return "mastered"
    return "learning"


def batch_grade_submissions(
    reference_pose: np.ndarray,
    student_poses: list[np.ndarray],
    passing_threshold: float = 0.75,
    **kwargs,
) -> list[GradingResult]:
    results = []
    for student_pose in student_poses:
        result = grade_sign_submission(
            reference_pose, student_pose, passing_threshold=passing_threshold, **kwargs
        )
        results.append(result)
    return results


def compute_practice_session_score(
    results: list[GradingResult], xp_per_correct: int = 5, xp_bonus_perfect: int = 20
) -> dict:
    total = len(results)
    correct = sum(1 for r in results if r.is_correct)
    accuracy = correct / total if total > 0 else 0.0
    is_perfect = (correct == total) and (total > 0)

    xp_earned = correct * xp_per_correct
    if is_perfect:
        xp_earned += xp_bonus_perfect

    avg_similarity = np.mean([r.similarity_score for r in results])

    return {
        "total_problems": total,
        "correct_count": correct,
        "accuracy": accuracy,
        "is_perfect": is_perfect,
        "xp_earned": xp_earned,
        "avg_similarity": float(avg_similarity),
        "avg_processing_time_ms": np.mean([r.processing_time_ms for r in results]),
    }
