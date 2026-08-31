import re

with open('src/types.ts', 'r') as f:
    content = f.read()

broadcast_type = """
export interface Broadcast {
  id?: string;
  hotelId: string;
  managerId: string;
  message: string;
  type: 'info' | 'alert' | 'event';
  isActive: boolean;
  createdAt: number;
}
"""

if "export interface Broadcast" not in content:
    content = content + "\n" + broadcast_type
    with open('src/types.ts', 'w') as f:
        f.write(content)
