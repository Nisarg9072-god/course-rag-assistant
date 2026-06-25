#convert the mp4 to mo3

import os
import subprocess
files = os.listdir("Video")
print (files)
print("\n")
for file in files:
   
    tutorial_no=file.split(" [")[0].split(" #")[1]
    file_name =file.split(" ｜ ")[0]
    print (f"# {tutorial_no} {file_name}\n")
    subprocess.run(["ffmpeg", "-i" , f"Video/{file}",
                     f"audios/{tutorial_no}_{file_name}.mp3"] )

# subprocess.run(["ffmpeg", "-i", f"Video/sample.mp4" , f"audios/sample.mp3"])
