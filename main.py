import numpy as np
import time
from grading import grade_sign_submission


def gen_pose(frames=100, noise=0.0):
    t = np.linspace(0, 4 * np.pi, frames)
    pose = np.zeros((frames, 33, 3))
    for i in range(33):
        phase = i * 0.1
        pose[:, i, 0] = np.sin(t + phase) * 0.5
        pose[:, i, 1] = np.cos(t * 0.5 + phase) * 0.3
        pose[:, i, 2] = np.sin(t * 0.3 + phase) * 0.2
    if noise > 0:
        pose += np.random.randn(*pose.shape) * noise
    return pose


def test_basic():
    print("\n=== DTW Grading Tests ===\n")

    ref = gen_pose(50, 0)

    print("Input: ref(50 frames, 33 landmarks, noise=0.0)")

    tests = [
        ("vs identical+tiny noise", ref + np.random.randn(*ref.shape) * 0.001, ">95%"),
        ("vs similar (noise=0.03)", ref + np.random.randn(*ref.shape) * 0.03, ">70%"),
        ("vs different sign", gen_pose(50, 0.5), "<60%"),
    ]

    for desc, student, expected in tests:
        result = grade_sign_submission(ref, student, fps=10, downsample_target=10)
        status = "PASS" if result.is_correct else "FAIL"
        print(
            f"{desc:25} -> {result.similarity_score:5.1%} ({expected}) {status} [{result.processing_time_ms:.1f}ms]"
        )


def test_performance():
    print("\n=== Performance (300 frames) ===\n")

    ref = gen_pose(300, 0)
    student = gen_pose(300, 0.05)

    print("Input: ref(300f, noise=0) vs student(300f, noise=0.05)")

    for fps_in, fps_out in [(30, 30), (30, 15), (30, 10)]:
        start = time.time()
        result = grade_sign_submission(
            ref, student, fps=fps_in, downsample_target=fps_out
        )
        elapsed = (time.time() - start) * 1000
        frames_out = result.reference_frames // (fps_in // fps_out)
        print(
            f"{fps_in}fps->{fps_out}fps: {frames_out:3}f processed in {elapsed:5.1f}ms, score={result.similarity_score:.1%}"
        )


def test_progression():
    print("\n=== Mastery Progression (same sign, improving) ===\n")

    ref = gen_pose(100, 0)
    print("Input: ref(100f, noise=0) vs attempts with decreasing noise\n")

    mastery = 0.0
    for i in range(1, 6):
        noise = 0.2 * (1 - i / 5) + 0.02
        student = ref + np.random.randn(*ref.shape) * noise
        result = grade_sign_submission(
            ref,
            student,
            passing_threshold=0.75,
            current_mastery_score=mastery,
            times_seen=i - 1,
        )
        mastery = (
            result.similarity_score
            if i == 1
            else mastery * 0.8 + result.similarity_score * 0.2
        )
        status = "PASS" if result.is_correct else "FAIL"
        print(
            f"Attempt {i} (noise={noise:.3f}): {result.similarity_score:5.1%} | mastery={mastery:5.1%} | {result.mastery_level:8} {status}"
        )


def main():
    test_basic()
    test_performance()
    test_progression()


if __name__ == "__main__":
    main()
