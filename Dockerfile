FROM eclipse-temurin:20.0.1_9-jre-ubi9-minimal
LABEL maintainer="info@mclarkdev.com"
RUN curl -SL https://ftp.mclarkdev.com/uploads/artifacts/SpaceCommander/latest-server.tgz | tar -xzC /opt/
EXPOSE 80
WORKDIR "/opt/server"
CMD ["java", "-jar", "server.jar", "--port", "80", "--db", "jdbc:mysql://tsc:tsc@127.0.0.1/tsc?serverTimezone=America/New_York"]
