import tensorflow as tf

# Load the full model from the HDF5 file
model = tf.keras.models.load_model('./sign_language_model.h5')

# Get the model configuration as a JSON-serializable dictionary
model_config = model.get_config()

# Convert the config to a JSON string
import json
model_config_json = json.dumps(model_config, indent=2)

# Save the JSON string to a file
with open('model_config.json', 'w') as json_file:
    json_file.write(model_config_json)
