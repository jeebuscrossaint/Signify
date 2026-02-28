import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import cv2
import time
import os
import glob
import pandas as pd
import keras
import re

baseOptions = mp.tasks.BaseOptions
BaseOptions = mp.tasks.BaseOptions
HandLandmarker = mp.tasks.vision.HandLandmarker
HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode


options = HandLandmarkerOptions(
    base_options=BaseOptions(model_asset_path='hand_landmarker.task'),
    running_mode=VisionRunningMode.VIDEO,
)

class Model:
    def __init__(self):
        self.model = keras.models.load_model('model.keras')
    
    def predict(self, features):
        if self.model is not None:
            return self.model.predict(features) # pyright: ignore[reportFunctionMemberAccess]
model = Model()

def draw_landmarks_on_image(rgb_image, detection_result):
    """Draw hand landmarks on the image."""
    print(detection_result.handedness)
    
    # Convert to BGR for OpenCV
    annotated_image = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2BGR)
    
    if len(detection_result.handedness) == 0:
        print("No hands detected.")
        return annotated_image
    
    for hand_landmarks in detection_result.hand_landmarks:
        # Draw landmarks
        for landmark in hand_landmarks:
            x = int(landmark.x * annotated_image.shape[1])
            y = int(landmark.y * annotated_image.shape[0])
            cv2.circle(annotated_image, (x, y), 5, (0, 255, 0), -1)
        
        # Draw connections between landmarks
        connections = [
            # Thumb
            (0, 1), (1, 2), (2, 3), (3, 4),
            # Index finger
            (0, 5), (5, 6), (6, 7), (7, 8),
            # Middle finger
            (0, 9), (9, 10), (10, 11), (11, 12),
            # Ring finger
            (0, 13), (13, 14), (14, 15), (15, 16),
            # Pinky
            (0, 17), (17, 18), (18, 19), (19, 20)
        ]
        
        for connection in connections:
            start_idx, end_idx = connection
            if start_idx < len(hand_landmarks) and end_idx < len(hand_landmarks):
                start_point = hand_landmarks[start_idx]
                end_point = hand_landmarks[end_idx]
                start_x = int(start_point.x * annotated_image.shape[1])
                start_y = int(start_point.y * annotated_image.shape[0])
                end_x = int(end_point.x * annotated_image.shape[1])
                end_y = int(end_point.y * annotated_image.shape[0])
                cv2.line(annotated_image, (start_x, start_y), (end_x, end_y), (255, 0, 0), 2)
    
    return annotated_image

        # Initialize data storage for Excel file
hand_data = []

def extract_hand_features(detection_result):
    """Extract hand landmarks and features for Excel export."""
    if len(detection_result.hand_landmarks) == 0:
        return None
    
    df = pd.DataFrame()
    for hand_idx, hand_landmarks in enumerate(detection_result.hand_landmarks[0]):        
        # Add landmark coordinates
        for landmark_idx, landmark in enumerate(hand_landmarks):
            print(landmark_idx)
            df[f'hand_{landmark_idx}_x'] = landmark.x 
            df[f'hand_{landmark_idx}_y'] = landmark.y
            df[f'hand_{landmark_idx}_z'] = landmark.z

    hand_data.append(df)
    if (len(hand_data) == 120): # Process every 120 frames (approximately every 4 seconds at 30 FPS)
        all_data = pd.concat(hand_data, ignore_index=True)
        model.predict(all_data.to_numpy()) # pyright: ignore[reportFunctionMemberAccess]
        hand_data.clear()  # Clear the data after processing

features = []

with HandLandmarker.create_from_options(options) as landmarker:
    # Now the hand landmarker is initialized and ready to process images.
    cap = cv2.VideoCapture(0)  # Use the default webcam
    timestamp = 0
    while cap.isOpened():
        success, image = cap.read()
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # Create MediaPipe image
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_rgb)
        
        # Process the frame
        timestamp += 1
        latest_result = landmarker.detect(mp_image)
        
        annotated_image = draw_landmarks_on_image(image_rgb, latest_result)
        if annotated_image is not None:
            cv2.imshow('Hand Landmarks', annotated_image)
        if cv2.waitKey(5) & 0xFF == 27:  # ESC key
            break
            
        # Inside the main loop, after landmarker.detect_async, replace the display code:
        if latest_result is not None:
            extract_hand_features(latest_result)
    
    # After processing all images, save the features to an Excel file
    cv2.destroyAllWindows()

    