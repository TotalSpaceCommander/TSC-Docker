FROM ubuntu:latest
LABEL maintainer="info@mclarkdev.com"
RUN apt-get -y update
RUN apt-get -y install openjdk-11-jre
RUN apt-get -y install curl
RUN curl -SL https://ftp.mclarkdev.com/uploads/artifacts/TouchHome/latest-server.tgz | tar -xzC /opt/
RUN curl -SL https://ftp.mclarkdev.com/uploads/artifacts/TouchHome/latest-images.tgz | tar -xzC /opt/server/resources/controller/
EXPOSE 8080
WORKDIR "/opt/server"
CMD ["/usr/bin/java", "-jar", "server.jar", "--port", "8080", "--db", "jdbc:mysql://tsc:tsc@127.0.0.1/tsc"]
