FROM gcc:13-slim
RUN useradd -m sandboxuser
USER sandboxuser
WORKDIR /sandbox
CMD ["sh", "-c", "g++ -O2 -o main main.cpp && ./main"]
