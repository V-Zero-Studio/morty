import pandas as pd
import matplotlib.pyplot as plt
import json
from datetime import datetime

DATA_FILE = "morty_log_2024-08-24T03_31_04.319Z.json"

START_DATE = "08/21/2024"
END_DATE = "08/31/2024"

cnt_sessions = 0
cnt_mouse_enter = 0
cnt_mouse_leave = 0

if __name__ == "__main__":
    with open(DATA_FILE, 'r') as file:
        data = json.load(file)

    print("total # of session entries:", len(data))

    start_date = datetime.strptime(START_DATE, "%m/%d/%Y")
    end_date = datetime.strptime(END_DATE, "%m/%d/%Y")
    for key in data:
        # print(str_entry)
        entry = data[key]
        date_str = entry["timeStamp"]
        date_entry = datetime.fromisoformat(date_str.replace("Z", "+00:00")).replace(tzinfo=None)
        if start_date > date_entry and date_entry > end_date:
            continue

        cnt_sessions += 1

        int_bev = data[key]["interactionBehaviors"]

        cnt_mouse_enter += len(int_bev["mouseenterEvents"])
        cnt_mouse_leave += len(int_bev["mouseleaveEvents"])

    print("avg mouse enter events:", cnt_mouse_enter / cnt_sessions)
    print("avg mouse leave events:", cnt_mouse_leave / cnt_sessions)
