class Connector {
  constructor(url, actions, store) {
    this.ws = new WebSocket(url);
    this.actions = actions;
    this.store = store;
  }

  connect() {
    this.ws.addEventListener('open', () => {
      console.info('Websocket connected');
    });

    this.ws.addEventListener('message', ({ data }) => {
      const { type, error, payload } = JSON.parse(data);

      if (error) {
        throw error;
      }

      switch (type) {
        case 'joined': {
          this.handleJoined(payload);
          break;
        }
        case 'peer joined': {
          this.handlePeerJoined(payload);
          break;
        }
        case 'peer left': {
          this.handlePeerLeft(payload);
          break;
        }
        case 'offer': {
          this.handleOffer(payload);
          break;
        }
        case 'answer': {
          this.handleAnswer(payload);
          break;
        }
        case 'candidate': {
          this.handleCandidate(payload);
          break;
        }
        case 'message': {
          this.handleMessage(payload);
          break;
        }
        default: {
          break;
        }
      }
    });

    this.ws.addEventListener('error', () => {
      console.info('Websocket connection error');
    });
  }

  send(data) {
    this.ws.send(JSON.stringify(data));
  }

  getClient(id) {
    return this.store.getState().clients.get(id);
  }

  async createPeerConnection(peerId, userName, type) {
    const peerConn = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun2.1.google.com:19302' }],
    }, {
      optional: [{ RtpDataChannels: true }],
    });

    peerConn.addEventListener('negotiationneeded', async () => {
      switch (type) {
        case 'offer': {
          const offer = await peerConn.createOffer();
          await peerConn.setLocalDescription(offer);

          this.send({
            type: 'offer',
            payload: {
              calleeId: peerId,
              offer,
            },
          });

          console.info(`Sent offer to ${peerId}`);
          break;
        }
        case 'answer': {
          const answer = await peerConn.createAnswer();
          await peerConn.setLocalDescription(answer);

          this.send({
            type: 'answer',
            payload: {
              callerId: peerId,
              answer,
            },
          });

          console.info(`Sent answer to ${peerId}`);
          break;
        }
        default: {
          break;
        }
      }
    });

    peerConn.addEventListener('icecandidate', ({ candidate }) => {
      if (candidate) {
        this.send({
          type: 'candidate',
          payload: {
            peerId,
            candidate,
          },
        });

        console.info(`Sent icecandidate to ${peerId}`);
      }
    });

    peerConn.addEventListener('addstream', ({ stream }) => {
      // Update peer's stream
      this.actions.setClient({ uid: peerId, stream });

      console.info(`Received remote stream from ${peerId}`);
    });

    peerConn.addEventListener('error', (err) => {
      console.info(err);
    });

    // Start sending client's self-view stream to peer
    const stream = await this.createSelfViewStream();
    peerConn.addStream(stream);

    // Update peer before peer's stream arrival
    this.actions.setClient({ uid: peerId, userName, peerConn, stream });

    return peerConn;
  }

  async createSelfViewStream() {
    // Create self-view stream
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });

    // Update stream to client itself
    const { uid } = this.store.getState();
    this.actions.setClient({ uid, stream });

    return stream;
  }

  async handleJoined({ uid, userName }) {
    this.actions.setUser(uid);
    this.actions.setClient({ uid, userName });
  }

  async handlePeerJoined({ calleeId, userName }) {
    await this.createPeerConnection(calleeId, userName, 'offer');
  }

  async handleOffer({ callerId, userName, offer }) {
    console.info(`Received offer from ${callerId}`);

    const peerConn = await this.createPeerConnection(callerId, userName, 'answer');
    await peerConn.setRemoteDescription(new RTCSessionDescription(offer));
  }

  async handleAnswer({ calleeId, answer }) {
    console.info(`Received answer from ${calleeId}`);

    await this.getClient(calleeId).peerConn.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async handleCandidate({ peerId, candidate }) {
    console.info(`Received candidate from ${peerId}`);

    const client = this.getClient(peerId);
    if (client && client.peerConn) {
      await client.peerConn.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  handleMessage({ userName, message }) {
    this.actions.addMessage(userName, message);
  }

  handlePeerLeft({ uid }) {
    console.log(`Peer ${uid} has left`);
    this.actions.deleteClient(uid);
  }

  joinRoom(roomName, userName) {
    // Notify server a join event
    this.send({
      type: 'join',
      payload: {
        roomName,
        userName,
      },
    });
  }

  leaveRoom() {
    this.send({
      type: 'leave',
      payload: {
        uid: this.store.getState().uid,
      },
    });

    this.store.getState().clients.forEach((client) => {
      if (client.peerConn) {
        client.peerConn.close();
      }
    });
  }

  sendMessage(message) {
    // Notify server a message event
    this.send({
      type: 'message',
      payload: {
        message,
      },
    });
  }
}

export default Connector;
