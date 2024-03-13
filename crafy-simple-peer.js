class CrafySimplePeer {
  constructor() {
    this.global_stream;
    this.peers = {};
    this.senderInterval;
    this.inited = false;
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

  onPeerStreamDisconnected(stream, peer_id) {
    console.log('CrafySimplePeer > onPeerStreamDisconnected', stream, peer_id);
  }

  onPeerStreamVideoRemove(video, peer_id) {
    console.log('CrafySimplePeer > onPeerStreamVideoRemove', video, peer_id);
  }

  onPeerConnected(peer_id) {
    console.log('CrafySimplePeer > onPeerConnected', peer_id);
  }

  onPeerConnectionClosed(event, peer_id) {
    console.log('CrafySimplePeer > onPeerConnectionClosed', event, peer_id);
  }

  onPeerError(err, peer_id) {
    console.log('CrafySimplePeer > onPeerError', err, peer_id);
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
      savedThis.checkRemoteStreamsInterval();
    });
    peer.on('stream', stream => {
      savedThis.onStream(stream, peer_id);
    });
    this.peers[peer_id] = {
      'lastSignalChunk': [],
      'lastSignalSended': true,
      'lastSignalTime': 0,
      'metadata': metadata,
      'status': 'connecting',
      'receivedDataTimes': 0,
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
    this.onPeerError(err, peer_id);
  }

  onClose(event, peer_id) {
    this.peers[peer_id]['status'] = 'closed';
    this.onPeerConnectionClosed(event, peer_id);
  }

  onStream(stream, peer_id) {
    this.peers[peer_id]['stream'] = stream;
    this.peers[peer_id]['stream_video'] = document.createElement('video');
    if ('srcObject' in this.peers[peer_id]['stream_video']) {
      this.peers[peer_id]['stream_video'].srcObject = stream;
    } else {
      this.peers[peer_id]['stream_video'].src = window.URL.createObjectURL(stream); // for older browsers
    }
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

  checkRemoteStreams() {
    for (const [peer_id, peer_data] of Object.entries(this.peers)) {
      if (peer_data['stream'] !== undefined) {
        if (!peer_data['stream'].active) {
          this.onPeerStreamDisconnected(this.peers[peer_id]['stream'], peer_id);
          delete this.peers[peer_id]['stream'];
          if (this.peers[peer_id]['stream_video'] !== undefined) {
            this.onPeerStreamVideoRemove(this.peers[peer_id]['stream_video'], peer_id);
            this.peers[peer_id]['stream_video'].remove();
            delete this.peers[peer_id]['stream_video'];
          }
        }
      }
    }
  }

  async checkRemoteStreamsInterval() {
    var check_times = 3; // How many times must to execute check
    for (let index = 0; index < check_times; index++) {
      this.checkRemoteStreams();
      await this.sleep(5000);
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

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  generatePeerId() {
    return Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2) + '_' + Date.now();
  }

  getStream(get_video = true, get_audio = true) {
    return new Promise(function (resolve, reject) {
      navigator.mediaDevices.getUserMedia({
        video: get_video,
        audio: get_audio
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

  stopThisStream(stream) {
    var tracks = stream.getTracks();
    // Detener cada pista de medios
    tracks.forEach(function (track) {
      track.stop();
    });
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
    this.peers[peer_id]['receivedDataTimes'] += 1;
    this.checkRemoteStreamsInterval();
  }

  // Send string message to the other peer

  sendMessage(message, peer_id) {
    if (this.peers[peer_id]['status'] == 'connected') {
      this.peers[peer_id]['peer'].send(message);
      return true;
    } else {
      return false;
    }
  }

  // Get peer data

  getPeerChannelName(peer_id) {
    if (this.peers[peer_id] !== undefined) {
      if (this.peers[peer_id]['peer'].channelName !== undefined) {
        return this.peers[peer_id]['peer'].channelName;
      }
    }
    return false;
  }

  getPeerMetadata(peer_id) {
    if (this.peers[peer_id] !== undefined) {
      return this.peers[peer_id]['metadata'];
    }
    return false;
  }

  getPeerReceivedDataTimes(peer_id) {
    if (this.peers[peer_id] !== undefined) {
      return this.peers[peer_id]['receivedDataTimes'];
    }
    return false;
  }

  // Custom stream by peer managment

  // getStream(get_video = true, get_audio = true).then().catch();

  addStreamToPeer(peer_id, stream) {
    if (this.peers[peer_id] !== undefined && this.peers[peer_id]['status'] == 'connected') {
      if (
        this.peers[peer_id]['local_stream_copy'] !== undefined &&
        this.peers[peer_id]['local_stream_copy'] == stream
      ) {
        this.peers[peer_id]['local_stream'] = stream;
      } else {
        this.peers[peer_id]['peer'].addStream(stream);
        this.peers[peer_id]['local_stream'] = stream;
        this.peers[peer_id]['local_stream_copy'] = stream;
      }
      return true;
    }
    return false;
  }

  removeLocalStreamToPeer(peer_id, only_index = false) {
    if (this.peers[peer_id] !== undefined && this.peers[peer_id]['local_stream'] !== undefined) {
      if (!only_index) {
        this.peers[peer_id]['peer'].removeStream(this.peers[peer_id]['local_stream']);
        delete this.peers[peer_id]['local_stream_copy'];
      }
      delete this.peers[peer_id]['local_stream'];
      return true;
    }
    return false;
  }

  removeRemoteStreamToPeer(peer_id) {
    if (this.peers[peer_id] !== undefined && this.peers[peer_id]['stream'] !== undefined) {
      if (this.peers[peer_id]['stream_video'] !== undefined) {
        this.onPeerStreamVideoRemove(this.peers[peer_id]['stream_video'], peer_id);
        this.peers[peer_id]['stream_video'].remove();
        delete this.peers[peer_id]['stream_video'];
      }
      this.stopThisStream(this.peers[peer_id]['stream']);
      delete this.peers[peer_id]['stream'];
      return true;
    }
    return false;
  }

  stream_isVideoMuted(stream) {
    var is_muted = false;
    stream.getVideoTracks().forEach(track => {
      if (!track.enabled) {
        is_muted = true;
      }
    });
    return is_muted;
  }

  stream_isAudioMuted(stream) {
    var is_muted = false;
    stream.getAudioTracks().forEach(track => {
      if (!track.enabled) {
        is_muted = true;
      }
    });
    return is_muted;
  }

  stream_toggleMuteVideo(stream, mode = 0) {
    if (mode == 0) {
      stream.getVideoTracks().forEach(track => {
        track.enabled = false; // Desactivar
      });
    } else {
      stream.getVideoTracks().forEach(track => {
        track.enabled = true; // Activar
      });
    }
  }

  stream_toggleMuteAudio(stream, mode = 0) {
    if (mode == 0) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = false; // Desactivar
      });
    } else {
      stream.getAudioTracks().forEach(track => {
        track.enabled = true; // Activar
      });
    }
  }

  // Set this.global_stream

  setGlobalStream(custom_stream) {
    savedThis.global_stream = custom_stream;
  }

  // Must to init before use it

  async init(try_get_stream = true) {
    var savedThis = this;
    if (!savedThis.inited) {
      savedThis.inited = true;
      savedThis.senderInterval = setInterval(() => {
        savedThis.sendSignalsChecker();
      }, 1000);
      var getStreamTry;
      if (try_get_stream) {
        getStreamTry = await savedThis.tryGetStream();
      }
    }
    return true;
  }
}