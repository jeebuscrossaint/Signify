"""
Test DTW grading with DataFrame format (35 joints, x,y coords).
"""

import pandas as pd
import numpy as np
from data_loader import create_example_data, split_by_label_changes
from dataframe_grading import grade_sign_from_dataframe, batch_grade_from_stream


def test_basic_grading():
    print("\n=== DataFrame Grading Test ===\n")

    # Create reference data (tutor video)
    print("Creating reference data: 'hello' sign (50 frames, 35 joints)")
    ref_df = create_example_data(num_frames=50, label="hello")

    # Create student attempts with varying noise
    tests = [
        ("perfect", 0.001),
        ("good", 0.03),
        ("okay", 0.08),
        ("poor", 0.20),
    ]

    print("\nGrading student attempts:\n")

    for name, noise in tests:
        # Create noisy version of reference
        student_df = ref_df.copy()
        for col in student_df.columns:
            if col != "label":
                student_df[col] += np.random.randn(len(student_df)) * noise

        result = grade_sign_from_dataframe(
            reference_df=ref_df,
            student_df=student_df,
            reference_label="hello",
            passing_threshold=0.75,
            fps=30,
            downsample_target=10,
        )

        status = "PASS" if result.is_correct else "FAIL"
        print(
            f"{name:8} (noise={noise:.3f}): {result.similarity_score:5.1%} {status} [{result.processing_time_ms:.1f}ms]"
        )


def test_multi_sign_stream():
    print("\n\n=== Multi-Sign Stream Test ===\n")

    # Create reference data with 3 different signs
    ref_hello = create_example_data(60, "hello")
    ref_thanks = create_example_data(55, "thanks")
    ref_goodbye = create_example_data(50, "goodbye")
    ref_df = pd.concat([ref_hello, ref_thanks, ref_goodbye], ignore_index=True)

    print(f"Reference data: {len(ref_df)} total frames")
    print("  - hello: 60 frames")
    print("  - thanks: 55 frames")
    print("  - goodbye: 50 frames")

    # Create student stream with same 3 signs (with noise)
    student_hello = ref_hello.copy()
    student_thanks = ref_thanks.copy()
    student_goodbye = ref_goodbye.copy()

    for df in [student_hello, student_thanks, student_goodbye]:
        for col in df.columns:
            if col != "label":
                df[col] += np.random.randn(len(df)) * 0.05

    student_df = pd.concat(
        [student_hello, student_thanks, student_goodbye], ignore_index=True
    )

    print(f"\nStudent stream: {len(student_df)} frames")

    # Split by label changes
    segments = split_by_label_changes(student_df)
    print(f"Detected {len(segments)} sign segments\n")

    # Grade each segment
    results = batch_grade_from_stream(ref_df, student_df, passing_threshold=0.75)

    print("Results:")
    for i, (label, segment_df) in enumerate(segments):
        if i < len(results):
            r = results[i]
            status = "PASS" if r.is_correct else "FAIL"
            print(
                f"  {label:8} ({len(segment_df):2} frames): {r.similarity_score:5.1%} {status}"
            )


def test_dataframe_structure():
    print("\n\n=== DataFrame Structure ===\n")

    df = create_example_data(5, "test")

    print(f"Shape: {df.shape}")
    print(
        f"Columns: {len(df.columns)} ({', '.join(list(df.columns[:3]) + ['...'] + list(df.columns[-2:]))})"
    )
    print(f"\nFirst 3 rows:\n")

    # Show first few columns
    cols_to_show = ["label", "hand_0_x", "hand_0_y", "hand_1_x", "hand_1_y"]
    print(df[cols_to_show].head(3).to_string(index=False))

    print("\n\nActual column format:")
    print("  - hand_0_x, hand_0_y  (joint 0)")
    print("  - hand_1_x, hand_1_y  (joint 1)")
    print("  - ...")
    print("  - hand_34_x, hand_34_y (joint 34)")
    print("  - label (sign name/phrase)")


def main():
    test_dataframe_structure()
    test_basic_grading()
    test_multi_sign_stream()


if __name__ == "__main__":
    main()
