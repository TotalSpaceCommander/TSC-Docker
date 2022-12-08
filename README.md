# SpaceCommander with Docker

Tested on Ubuntu 22.04.1 (Server)

The TSC _server_ runs headless - all user interfaces are connected remotely via Web Browser.

Packages can be installed manually, however our Docker Compose file makes startup of all the required dependencies as simple as running a single command.



### Prerequisites

Running the TSC Platform as a Docker container requires little more then docker itself to run.

Using the package manager for your system, download and install the following packages
```
apt-get install git docker python3-pip
```

Then using pip3
```
pip3 install docker-compose
```

### Clone Repository

Clone this repository which has the files required to get things going.

```
git clone https://git.mclarkdev.com/SpaceCommander/TSC-Docker.git
cd TSC-Docker
```

### Build the TSC Image

```
sudo docker build --no-cache -t tsc-img .
```

*Note*: The `--no-cache` option must be used to download the latest version of the SpaceCommander platform each time a new image is built.

### Start the stack

Using _docker-compose_, all platform dependencies can be easily managed. Simply run the following command to start all stack components.

```
sudo docker-compose -f docker-compose.yml up -d
```

Once the stack is running, find the LAN address of your host and navigate to the user interface using any web-browser on the same network.

```
http://-hostIP-/controller/
```

### Stop the stack

All containers can be stopped using the same docker-compose file.

```
sudo docker-compose -f docker-compose.yml down
```

### Install systemd service

For environments using systemd, the supplied service file can be installed for managing the stack.

```
# Move to known location
mv TSC-Docker /opt

# Install service file
cp /opt/TSC-Docker/tsc-stack.service /etc/systemd/system/

# Reload daemon
systemctl daemon-reload

# Start at boot
systemctl enable tsc-stack.service

# Start / Stop / Restart
systemctl start tsc-stack.service
systemctl stop tsc-stack.service
systemctl restart tsc-stack.service

# Stack logs
journalctl -xfu tsc-stack
```

### Persistance

#### Server Logs

Server logs are located on a Docker persistent volume and can be accessed from the host at the known volume path.

#### Persistent Data

One of the several Docker containers you will find running is an instance of MySQL/MariaDB database server. This container will contain a Docker persistent volume on which it will store the database files. Databases and system configuration will remain through platform restarts.

