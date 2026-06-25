import whisper
import subprocess
import os
import json

model =whisper.load_model("large-v2")
audios = os.listdir("audios")

for audio in audios:
    number= audio.split("_")[0]
    title=audio.split("_")[1][:-4]

    result=model.transcribe (audio =f"audios/{audio}",
                            language="hi",
                            task ="translate",
                            word_timestamps=False)

    chunks=[]
    for segment in result["segments"]:
        chunks.append({"number": number,
                       "title": title,
                        "start":segment["start"],
                        "end":segment["end"],
                        "text": segment["text"]})
        
    chunks_with_metadata ={"chunks":chunks,"text":result["text"]}

    with open(f"json/{audio}.json","w")as f:
        json.dump(chunks_with_metadata,f)
    