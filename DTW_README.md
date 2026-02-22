# ASL Sign Grading Backend

DTW + Z-score normalization for comparing ASL signs. Fast, accurate, minimal BS.

## Files

- **`zscore.py`** - Z-normalization for pose data
- **`dtw.py`** - Dynamic Time Warping with dtaidistance C backend
- **`pose_utils.py`** - MediaPipe pose processing
- **`grading.py`** - Main grading API
- **`main.py`** - Demo/tests

## Usage

```python
from grading import grade_sign_submission

# reference_pose and student_pose: (frames, joints, coords) numpy arrays
result = grade_sign_submission(
    reference_pose=reference_pose,
    student_pose=student_pose,
    passing_threshold=0.75,
    fps=30
)

print(f"Score: {result.similarity_score:.2%}")
print(f"Correct: {result.is_correct}")
print(f"Feedback: {result.feedback_message}")
```

## Run Demo

```bash
uv run python main.py
```

## Performance

- ~12-15ms per comparison (300 frames at 30fps)
- Handles 60+ comparisons/second
- Downsampling 30fps → 10fps recommended

## Integration

See `api_integration_example.py` for Nuxt endpoint examples.

Key functions:
- `grade_sign_submission()` - Main grading function
- `compute_dtw_similarity()` - Core DTW comparison
- `z_normalize_per_joint()` - Normalize pose data

## How It Works

1. **Z-normalization**: Makes motion scale-invariant
2. **Downsampling**: 30fps → 10fps for speed
3. **DTW**: Compares trajectories with windowed constraint
4. **Weighting**: Emphasizes hands/arms over legs
5. **Scoring**: Exponential decay converts distance to similarity

## Tuning

Adjust these in your code:
- `passing_threshold` (default 0.75) - Minimum score to pass
- `scale` in dtw.py (default 15.0) - Similarity scaling
- `window_pct` (default 0.1) - DTW window size

Test with real data and tune accordingly.
