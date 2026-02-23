import tensorflow as tf

# Load the existing .h5
model = tf.keras.models.load_model('./sign_language_model.h5')

# Save as TF SavedModel format (not .h5)
model.export('./sign_language_model_saved')