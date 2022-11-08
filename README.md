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
sudo docker build -t tsc-img .
```

### Start the stack

```
sudo docker-compose -f docker-compose.yml up -d
```

Once the stack is running, find the IP address of your host and navigate to the user interface using any web-browser on the same network.

```
http://<<host.ip>>:8080/
```

### Stop the stack

```
sudo docker-compose -f docker-compose.yml down
```

