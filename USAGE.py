"""
Quick start guide for DataFrame-based ASL grading.

Your data format:
- DataFrame with columns: hand_0_x, hand_0_y, hand_1_x, hand_1_y, ..., hand_34_x, hand_34_y, label
- 35 joints total (hand_0 to hand_34)
- Each joint has x and y coordinates
- label column identifies the sign (use 0 or '0' to mark video boundaries)
"""

import pandas as pd
from dataframe_grading import grade_sign_from_dataframe, batch_grade_from_stream


# EXAMPLE 1: Grade a single sign submission
# -----------------------------------------

# Load your tutor reference data (pre-recorded videos)
tutor_df = pd.read_csv("tutor_videos.csv")  # Replace with your actual file

# Load student submission
student_df = pd.read_csv("student_submission.csv")  # Replace with your actual file

# Grade the submission
result = grade_sign_from_dataframe(
    reference_df=tutor_df,
    student_df=student_df,
    reference_label="hello",  # Which sign to compare
    passing_threshold=0.75,  # 75% similarity required to pass
    fps=30,  # Original frame rate
    downsample_target=10,  # Downsample to 10fps for faster processing
)

print(f"Score: {result.similarity_score:.1%}")
print(f"Result: {'PASS' if result.is_correct else 'FAIL'}")
print(f"Feedback: {result.feedback_message}")
print(f"Processing time: {result.processing_time_ms:.1f}ms")


# EXAMPLE 2: Grade multiple signs from continuous recording
# ----------------------------------------------------------

# Student records multiple signs in one session
# The label column changes to indicate different signs
student_stream_df = pd.read_csv("student_stream.csv")

# Automatically detect and grade each sign
results = batch_grade_from_stream(
    reference_df=tutor_df,
    student_stream_df=student_stream_df,
    passing_threshold=0.75,
)

for i, result in enumerate(results):
    print(
        f"Sign {i + 1}: {result.similarity_score:.1%} {'PASS' if result.is_correct else 'FAIL'}"
    )


# EXAMPLE 3: Real-time streaming (frame by frame)
# ------------------------------------------------

# As user records, you collect data frame by frame:
streaming_buffer = []


def on_new_frame(hand_joints_x, hand_joints_y, current_label):
    """Called each time MediaPipe extracts new frame."""
    frame_data = {"label": current_label}

    # Add all 35 joints
    for joint_idx in range(35):
        frame_data[f"hand_{joint_idx}_x"] = hand_joints_x[joint_idx]
        frame_data[f"hand_{joint_idx}_y"] = hand_joints_y[joint_idx]

    streaming_buffer.append(frame_data)

    # When sign is complete (label changes to 0 or next sign):
    if current_label == 0 or len(streaming_buffer) > 100:
        # Grade accumulated frames
        student_df = pd.DataFrame(streaming_buffer)
        result = grade_sign_from_dataframe(
            reference_df=tutor_df,
            student_df=student_df,
            reference_label="hello",  # Or detect from student_df
        )

        # Show result to user
        print(f"Score: {result.similarity_score:.1%}")

        # Clear buffer for next sign
        streaming_buffer.clear()


# EXAMPLE 4: Convert from your existing format
# ---------------------------------------------

# If your data is in a different format, convert it:


def convert_to_dataframe(joint_positions_per_frame, sign_label):
    """
    Convert your format to DataFrame.

    Args:
        joint_positions_per_frame: List of frames, each frame is array (35, 2)
        sign_label: String label for this sign
    """
    rows = []
    for frame in joint_positions_per_frame:
        row = {"label": sign_label}
        for joint_idx in range(35):
            row[f"hand_{joint_idx}_x"] = frame[joint_idx, 0]
            row[f"hand_{joint_idx}_y"] = frame[joint_idx, 1]
        rows.append(row)

    return pd.DataFrame(rows)


# PERFORMANCE NOTES
# -----------------
# - Typical processing: 15-25ms per sign comparison
# - Downsampling 30fps -> 10fps speeds up DTW by ~2-3x
# - 60fps real-time camera -> downsample to 10fps = process 100+ signs/second
# - For web app: grade on backend, return results via API
