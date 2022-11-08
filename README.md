# SpaceCommander with Docker

Tested on Ubuntu 22.04.1 (Server)

The TSC _server_ runs headless - all user interfaces are connected remotely via Web Browser.

Packages can be installed manually, however our Docker Compose file makes starup of all the required depenedies as simple as running a single command.

After downloading and installing [Docker](https://docs.docker.com/engine/install/ubuntu/), clone this repository to your host.

```
sudo apt-get install docker
git clone https://git.mclarkdev.com/SpaceCommander/TSC-Docker.git
cd TSC-Docker
```

### Build the TSC Image

```
sudo docker build --no-cache -t tsc-img .
```

*Note* The `--no-cache` option must be used to download the latest version of the SpaceCommander platform each time a new image is built.

### Start the stack

Using _docker-compose_, all platform dependencies can be easily managed. Simply run the following command to start all components.

```
sudo docker-compose -f docker-compose.yml up -d
```

Once the stack is running, find the IP address of your host and navigate to the user interface using any web-browser on the same network.

```
http://<<host.ip>>:8080/
```

#### Server Logs

Server logs are located on a Docker persistent volume and can be accessed from the host at the known volume path.

#### Persistent Data

One of the several Docker containers you will find running is an instance of MySQL/MariaDB database server. This container will contain a Docker persistent volume on which it will store the database files. Databases and system configuration will remain through platform restarts.

### Stop the stack

All containers can be stopped using the same docker-compose file.

```
sudo docker-compose -f docker-compose.yml down
```

