"""
Example API integration for Nuxt server endpoints.

This shows how to use the grading system in your Nuxt API routes.
"""

import numpy as np
from grading import grade_sign_submission, batch_grade_submissions
import cv2


def process_video_to_pose(video_path: str) -> np.ndarray:
    """
    Process a video file to extract pose data using MediaPipe.

    This is a placeholder - you'll implement the actual MediaPipe processing.

    Args:
        video_path: Path to video file

    Returns:
        Pose array of shape (num_frames, num_landmarks, 3)
    """
    import mediapipe as mp

    mp_pose = mp.solutions.pose
    pose = mp_pose.Pose(
        static_image_mode=False,
        model_complexity=1,
        enable_segmentation=False,
        min_detection_confidence=0.5,
    )

    cap = cv2.VideoCapture(video_path)

    poses = []

    while cap.isOpened():
        success, image = cap.read()
        if not success:
            break

        # Convert to RGB
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        # Process with MediaPipe
        results = pose.process(image_rgb)

        if results.pose_landmarks:
            # Extract landmarks
            landmarks = []
            for landmark in results.pose_landmarks.landmark:
                landmarks.append([landmark.x, landmark.y, landmark.z])
            poses.append(landmarks)

    cap.release()
    pose.close()

    return np.array(poses)


# ============================================================================
# Example Nuxt Server API Endpoint (Python via child_process or separate service)
# ============================================================================


def api_verify_sign(data: dict) -> dict:
    """
    API endpoint: /api/verify/sign

    Request body:
    {
        "sign_id": "uuid",
        "session_id": "uuid",
        "problem_id": "uuid",
        "reference_video_path": "path/to/reference.mp4",
        "student_video_path": "path/to/student.mp4",
        "user_mastery_score": 0.5,
        "times_seen": 3,
        "fps": 30
    }

    Returns:
    {
        "is_correct": bool,
        "similarity_score": float,
        "confidence": float,
        "feedback_message": str,
        "mastery_level": str,
        "processing_time_ms": float
    }
    """
    try:
        # Extract request data
        reference_video = data["reference_video_path"]
        student_video = data["student_video_path"]
        mastery_score = data.get("user_mastery_score", 0.0)
        times_seen = data.get("times_seen", 0)
        fps = data.get("fps", 30)

        # Process videos to pose data
        # In production, you might cache the reference pose
        reference_pose = process_video_to_pose(reference_video)
        student_pose = process_video_to_pose(student_video)

        # Grade the submission
        result = grade_sign_submission(
            reference_pose=reference_pose,
            student_pose=student_pose,
            passing_threshold=0.75,
            fps=fps,
            downsample_target=10,
            use_adaptive_window=True,
            landmark_filter="upper_body",
            current_mastery_score=mastery_score,
            times_seen=times_seen,
        )

        # Return response
        return {
            "is_correct": result.is_correct,
            "similarity_score": result.similarity_score,
            "confidence": result.confidence,
            "feedback_message": result.feedback_message,
            "mastery_level": result.mastery_level,
            "processing_time_ms": result.processing_time_ms,
            "quality_issues": result.quality_issues,
        }

    except Exception as e:
        return {
            "error": str(e),
            "is_correct": False,
            "similarity_score": 0.0,
            "feedback_message": "Error processing video. Please try again.",
        }


# ============================================================================
# Example: Batch grading for practice session
# ============================================================================


def api_grade_practice_session(data: dict) -> dict:
    """
    API endpoint: /api/practice/:sessionId/grade

    Grades all problems in a practice session at once.

    Request body:
    {
        "problems": [
            {
                "problem_id": "uuid",
                "sign_id": "uuid",
                "reference_path": "path",
                "student_path": "path",
                "mastery_score": 0.5,
                "times_seen": 3
            },
            ...
        ],
        "fps": 30
    }

    Returns:
    {
        "results": [
            {
                "problem_id": "uuid",
                "is_correct": bool,
                "similarity_score": float,
                ...
            },
            ...
        ],
        "session_stats": {
            "accuracy": float,
            "xp_earned": int,
            ...
        }
    }
    """
    try:
        problems = data["problems"]
        fps = data.get("fps", 30)

        results = []

        for problem in problems:
            # Process both videos
            reference_pose = process_video_to_pose(problem["reference_path"])
            student_pose = process_video_to_pose(problem["student_path"])

            # Grade
            result = grade_sign_submission(
                reference_pose=reference_pose,
                student_pose=student_pose,
                passing_threshold=0.75,
                fps=fps,
                current_mastery_score=problem.get("mastery_score", 0.0),
                times_seen=problem.get("times_seen", 0),
            )

            results.append(
                {
                    "problem_id": problem["problem_id"],
                    "is_correct": result.is_correct,
                    "similarity_score": result.similarity_score,
                    "confidence": result.confidence,
                    "feedback_message": result.feedback_message,
                    "mastery_level": result.mastery_level,
                }
            )

        # Compute session stats
        from grading import compute_practice_session_score

        grading_results = []
        for r in results:
            # Convert to GradingResult-like object for stats computation
            from grading import GradingResult

            gr = GradingResult(
                similarity_score=r["similarity_score"],
                is_correct=r["is_correct"],
                confidence=r["confidence"],
                feedback_message=r["feedback_message"],
                mastery_level=r["mastery_level"],
                reference_frames=0,
                student_frames=0,
                processing_time_ms=0,
            )
            grading_results.append(gr)

        session_stats = compute_practice_session_score(grading_results)

        return {"results": results, "session_stats": session_stats}

    except Exception as e:
        return {"error": str(e), "results": [], "session_stats": {}}


# ============================================================================
# Example: Pre-cache reference poses
# ============================================================================


def preprocess_reference_videos(sign_data: list[dict]) -> dict:
    """
    Pre-process all reference videos and cache the pose data.

    Run this once when seeding your database or when adding new signs.
    Store the resulting pose arrays in a file or database.

    Args:
        sign_data: List of dicts with sign_id and video_path

    Returns:
        Dict mapping sign_id to pose array
    """
    pose_cache = {}

    for sign in sign_data:
        sign_id = sign["sign_id"]
        video_path = sign["video_path"]

        print(f"Processing {sign_id}...")
        pose = process_video_to_pose(video_path)

        # Save to cache (in production, save to file or DB)
        pose_cache[sign_id] = pose

        # Optionally save to disk
        # np.save(f"pose_cache/{sign_id}.npy", pose)

    return pose_cache


# ============================================================================
# Integration Tips
# ============================================================================

"""
INTEGRATION CHECKLIST:

1. **Nuxt Server Route** (server/api/verify/sign.ts):
   - Receive video upload or webcam stream
   - Save temporarily or process directly
   - Call Python service (via HTTP, child_process, or gRPC)
   - Return result to frontend

2. **Python Service Options**:
   Option A: FastAPI microservice
     - Separate Python FastAPI server
     - Nuxt calls it via HTTP
     - Easy to scale separately
   
   Option B: Child process
     - Nuxt spawns Python process
     - Pass data via stdin/stdout
     - Simpler for hackathon
   
   Option C: Shared filesystem
     - Nuxt writes video to temp file
     - Python reads, processes, writes result to file
     - Nuxt reads result

3. **MediaPipe Processing**:
   - Install: pip install mediapipe opencv-python
   - Process video frame-by-frame
   - Extract pose landmarks (33 points)
   - Stack into numpy array

4. **Caching Strategy**:
   - Pre-process all reference videos
   - Store pose arrays in Supabase or local files
   - Load on-demand (they're small, ~100KB per sign)

5. **Performance**:
   - MediaPipe processing: ~3-5ms per frame
   - DTW grading: 10-50ms depending on length
   - Total: ~1-2 seconds per submission
   - Your hardware can handle 10+ simultaneous requests

6. **Tuning**:
   - Adjust passing_threshold based on real user data
   - Start at 0.75, tune up/down
   - Different thresholds for letters vs words
   - More lenient for beginners
"""
