with open("temp.tsx", "r") as f:
    lines = f.readlines()

def find_line(pattern, start=0):
    for i in range(start, len(lines)):
        if pattern in lines[i]:
            return i
    return -1

r_start = find_line("{/* Stay / Menu tabs.")
c_start = find_line("{/* Availability Calendar */}")
room_start = find_line("<h2", c_start)
loc_start = find_line("{/* Full Directions & Navigation Panel for Guests */}")
rev_start = find_line("<div id=\"reviews\"", loc_start)
end = find_line("{/* Booking request */}") - 1 # </div> before it
while "<div" not in lines[end] and "</div>" not in lines[end]:
    end -= 1

print("r_start:", r_start)
print("c_start:", c_start)
print("room_start:", room_start)
print("loc_start:", loc_start)
print("rev_start:", rev_start)
print("end:", end)

restaurant = lines[r_start:c_start]
calendar = lines[c_start:room_start]
rooms = lines[room_start:loc_start]
location = lines[loc_start:rev_start]
reviews = lines[rev_start:end]

# Target Order:
# 1. Rooms
# 2. Calendar
# 3. Restaurant
# 4. Reviews
# 5. Location

new_lines = lines[:r_start] + rooms + calendar + restaurant + reviews + location + lines[end:]

with open("src/pages/HotelDetails.tsx", "w") as f:
    f.writelines(new_lines)

