class CrafySimplePeer {
  constructor() {
    this.global_stream;
    this.peers = {};
    this.senderInterval;
  }

  // Events

  onMustSignalingPeer(info, peer_id) {
    console.log('CrafySimplePeer > onMustSignalingPeer', info, peer_id);
  }

  onPeerMessage(message, peer_id) {
    console.log('CrafySimplePeer > onPeerMessage', message, peer_id);
  }

  onPeerStream(stream, peer_id) {
    console.log('CrafySimplePeer > onPeerStream', stream, peer_id);
  }

  onPeerConnected(peer_id) {
    console.log('CrafySimplePeer > onPeerConnected', peer_id);
  }

  onPeerConnectionClosed(event, peer_id) {
    console.log('CrafySimplePeer > onPeerConnectionClosed', event, peer_id);
  }

  // Create peer (new user to connect)

  createPeer(initiator = true, metadata = null) {
    var savedThis = this;
    var peer_id = this.generatePeerId();
    var peer_config = {
      initiator: initiator
    };
    if (this.global_stream !== undefined) {
      peer_config.stream = this.global_stream;
    }
    var peer = new SimplePeer(peer_config);
    peer.on('signal', data => {
      savedThis.onSignal(data, peer_id);
    });
    peer.on('connect', () => {
      savedThis.onConnect(peer_id);
    });
    peer.on('data', data => {
      savedThis.onData(data, peer_id);
    });
    peer.on('error', err => {
      savedThis.onError(err, peer_id);
    });
    peer.on('close', event => {
      savedThis.onClose(event, peer_id);
    });
    peer.on('stream', stream => {
      savedThis.onStream(stream, peer_id);
    });
    this.peers[peer_id] = {
      'lastSignalChunk': [],
      'lastSignalSended': true,
      'lastSignalTime': 0,
      'metadata': metadata,
      'status': 'connecting'
    };
    this.peers[peer_id]['peer'] = peer;
    return peer_id;
  }

  // Close connection with peer

  closePeer(peer_id) {
    this.peers[peer_id]['peer'].destroy();
    this.peers[peer_id]['status'] = 'closed';
  }

  closeAllPeers() {
    for (const [peer_id, peer_data] of Object.entries(this.peers)) {
      this.closePeer(peer_id);
    }
  }

  // Internal

  onSignal(data, peer_id) {
    let currTime = Date.now();
    this.peers[peer_id]['lastSignalSended'] = false;
    this.peers[peer_id]['lastSignalTime'] = currTime;
    this.peers[peer_id]['lastSignalChunk'].push(data);
  }

  onConnect(peer_id) {
    this.peers[peer_id]['status'] = 'connected';
    this.onPeerConnected(peer_id);
  }

  onData(data, peer_id) {
    this.onPeerMessage(this.convertirUint8ArrayAString(data), peer_id);
  }

  onError(err, peer_id) {
    console.error('CrafySimplePeer > onError - peer_id: ' + peer_id, err);
  }

  onClose(event, peer_id) {
    this.peers[peer_id]['status'] = 'closed';
    this.onPeerConnectionClosed(event, peer_id);
  }

  onStream(stream, peer_id) {
    this.peers[peer_id]['stream'] = stream;
    this.onPeerStream(stream, peer_id);
  }

  sendData(data, peer_id) {
    var info = btoa(JSON.stringify(data));
    this.onMustSignalingPeer(info, peer_id);
  }

  sendSignalsChecker() {
    var currTime = Date.now();
    for (const [peer_id, peer_data] of Object.entries(this.peers)) {
      if (!peer_data['lastSignalSended']) {
        if (currTime - peer_data['lastSignalTime'] > 3000) {
          this.sendData(peer_data['lastSignalChunk'], peer_id);
          this.peers[peer_id]['lastSignalChunk'] = [];
          this.peers[peer_id]['lastSignalSended'] = true;
        }
      }
    }
  }

  convertirUint8ArrayAString(variable) {
    if (variable instanceof Uint8Array) {
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(variable);
    } else {
      return variable.toString(); // Convertir cualquier otro tipo de variable a una cadena
    }
  }

  generatePeerId() {
    return Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2) + '_' + Date.now();
  }

  getStream() {
    return new Promise(function (resolve, reject) {
      navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      }).then(function (stream) {
        resolve(stream);
      }).catch((err) => {
        console.log('Error getting user media', err);
        reject(err);
      });
    });
  }

  tryGetStream() {
    var savedThis = this;
    return new Promise(function (resolve, reject) {
      savedThis.getStream().then(function (stream) {

        savedThis.global_stream = stream;

        savedThis.toggleMuteAudio(0);
        savedThis.toggleMuteVideo(0);

        resolve(true);

      }).catch(function (error) {
        resolve(false);
      });
    });
  }

  // Stop getting video from camera and audio from microphone

  stopStream() {
    if (this.global_stream === undefined) {
      return false;
    } else {
      var tracks = this.global_stream.getTracks();
      // Detener cada pista de medios
      tracks.forEach(function (track) {
        track.stop();
      });
      this.global_stream = undefined;
    }
  }

  // Toggle mute for audio from microphone and video from camera

  toggleMuteAudio(mode = 0) {
    // 0 = mute, 1 = unmute
    if (this.global_stream === undefined) {
      return false;
    }
    if (mode == 0) {
      this.global_stream.getAudioTracks().forEach(track => {
        track.enabled = false; // Desactivar el micrófono
      });
    } else {
      this.global_stream.getAudioTracks().forEach(track => {
        track.enabled = true; // Activar el micrófono
      });
    }
  }

  toggleCurrMuteAudio() {
    if (this.global_stream === undefined) {
      return false;
    }
    var is_muted = false;
    this.global_stream.getAudioTracks().forEach(track => {
      if (!track.enabled) {
        is_muted = true;
      }
    });
    if (is_muted) {
      this.toggleMuteAudio(1);
      return 1;
    } else {
      this.toggleMuteAudio(0);
      return 0;
    }
  }

  toggleMuteVideo(mode = 0) {
    // 0 = mute, 1 = unmute
    if (this.global_stream === undefined) {
      return false;
    }
    if (mode == 0) {
      this.global_stream.getVideoTracks().forEach(track => {
        track.enabled = false; // Desactivar el micrófono
      });
    } else {
      this.global_stream.getVideoTracks().forEach(track => {
        track.enabled = true; // Activar el micrófono
      });
    }
  }

  toggleCurrMuteVideo() {
    if (this.global_stream === undefined) {
      return false;
    }
    var is_muted = false;
    this.global_stream.getVideoTracks().forEach(track => {
      if (!track.enabled) {
        is_muted = true;
      }
    });
    if (is_muted) {
      this.toggleMuteVideo(1);
      return 1;
    } else {
      this.toggleMuteVideo(0);
      return 0;
    }
  }

  // Receive signaling data from the other peer

  receiveData(b64_data, peer_id) {
    var datas = JSON.parse(atob(b64_data));
    for (const data of datas) {
      this.peers[peer_id]['peer'].signal(data);
    }
  }

  // Send string message to the other peer

  sendMessage(message, peer_id) {
    this.peers[peer_id]['peer'].send(message);
  }

  // Must to init before use it

  async init(try_get_stream = true, custom_stream = false) {
    var savedThis = this;
    savedThis.senderInterval = setInterval(() => {
      savedThis.sendSignalsChecker();
    }, 1000);
    var getStreamTry;
    if (try_get_stream) {
      getStreamTry = await savedThis.tryGetStream();
    } else if (custom_stream !== false) {
      savedThis.global_stream = custom_stream;
    }
    return true;
  }
}