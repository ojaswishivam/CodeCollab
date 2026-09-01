FROM node:20-slim
RUN useradd -m sandboxuser
USER sandboxuser
WORKDIR /sandbox
CMD ["node", "main.js"]
