import pandas as pd
import matplotlib.pyplot as plt
import json

DATA_FILE = "morty_log_2024-08-24T03_31_04.319Z.json"

# - # of mouse enter

if __name__ == "__main__":
    # Open the JSON file
    with open(DATA_FILE, 'r') as file:
        # Load the JSON data into a Python dictionary
        data = json.load(file)

    # Print the data to ensure it's loaded correctly
    print(data)
