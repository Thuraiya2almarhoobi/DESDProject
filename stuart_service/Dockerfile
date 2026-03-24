FROM python:3.11-slim

WORKDIR /srv/stuart_service

COPY stuart_service/requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY stuart_service/ ./
RUN test -s /srv/stuart_service/server.py

EXPOSE 8020

CMD ["python", "server.py"]

