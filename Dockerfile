FROM eclipse-temurin:11-jre-ubi9-minimal
LABEL maintainer="info@mclarkdev.com"
RUN curl -SL https://ftp.mclarkdev.com/uploads/artifacts/TouchHome/latest-server.tgz | tar -xzC /opt/
RUN curl -SL https://ftp.mclarkdev.com/uploads/artifacts/TouchHome/latest-images.tgz | tar -xzC /opt/server/resources/controller/
EXPOSE 80
WORKDIR "/opt/server"
CMD ["java", "-jar", "server.jar", "--port", "80", "--db", "jdbc:mysql://tsc:tsc@127.0.0.1/tsc"]
