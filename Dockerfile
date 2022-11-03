LABEL maintainer="info@mclarkdev.com"
FROM ubuntu:18.04
RUN apt-get -y update
RUN apt-get -y install openjdk-11-jre
RUN apt-get -y install curl
RUN curl -SL https://ftp.mclarkdev.com/uploads/artifacts/TouchHome/server-96.tgz | tar -xzC /opt/
EXPOSE 8080
WORKDIR "/opt/server"
CMD ["/usr/bin/java", "-jar", "server.jar", "--port", "8080", "--db", "jdbc:mysql://tsc:tsc@127.0.0.1/tsc"]
