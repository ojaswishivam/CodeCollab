FROM python:3.11-slim
RUN useradd -m sandboxuser
USER sandboxuser
WORKDIR /sandbox
CMD ["python3", "main.py"]
