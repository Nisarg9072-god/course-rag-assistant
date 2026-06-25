import numpy as np
import pandas as pd
from sklearn.metrics.pairwise  import cosine_similarity 
import joblib
import requests

df = joblib.load('embedding.joblib')

def create_embedding(text_lists):

    r = requests.post("http://localhost:11434/api/embed", json={
        "model": "bge-m3",
        "input": text_lists
    })

    if not r.ok:
        raise RuntimeError(f"Ollama API error {r.status_code}: {r.text}")

    embedding = r.json()

    if "embeddings" not in embedding:
        raise KeyError(f"'embeddings' key not found in response. Full response: {embedding}")

    return embedding["embeddings"]

def inference(prompt):
    r = requests.post("http://localhost:11434/api/generate", json={
        "model": "llama3.2",
        "prompt": prompt,
        "stream": False
    })
    response =r.json()
    print(response)
    return response

incoming_query= input ("Ask a Question:")
Question_embedding = create_embedding([incoming_query])

# find similarity of qiestion _embedding with other embedding
# print(np.vstack(df['embedding'].values))
# print(np.vstack(df['embedding']).shape)
similarities = cosine_similarity(np.vstack(df['embedding']),np.vstack([Question_embedding])).flatten()
# print(similarities)

top_results=30
max_indx = similarities.argsort()[::-1][0:top_results]
# print(max_indx)
new_df = df.loc[max_indx]
# print(new_df[["title",'number','text']])

prompt =f'''
I am teaching web development using sigma web development course. here are video 
subtitle chunks containing video title , video number, start time in seconds , end time in seconds , the text at the time:
{new_df[["title",'number','text','start']].to_json(orient ="records")}
------------------------------------
"{incoming_query}"
User asked this question related to the video chunks , you have to answer in humane way (dont mention the above formate its jus for you) where and how much content is taught in which video (in which video and at what timestamp) and guide the user to go to that particular video .if users unrelated question , tell him that you can only answer question related to the course
'''

with open ("prompt.txt","w")as f:
    f.write(prompt)

response =inference(prompt)['response']
print(response)

with open("response.txt","w") as f:
    f.write(response)
# for index ,item in new_df.iterrows():
#     print(index , item['title'], item['number'],item['text'],item['start'],item['end'])