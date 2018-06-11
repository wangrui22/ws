const MSG_HEADER_LEN = 32;

class SocketClient {
    constructor() {
        this._tcpPacketEnd = 0;
        this._msgCmdID = 0;
        this._msgCellID = 0;
        this._msgOpID = 0;
        this._msgRestDataLen = 0;
        this._lastMsgHeader = new ArrayBuffer(MSG_HEADER_LEN);
        this._lastMsgHeaderLen = 0;
        
        this.protocRoot = null;
        this._bwDataPool = 0;
        this._bwTime = Date.now();
        this._bw = 0;
        this._bwParseTime = 0;
    }

    //Handler(cmdID, cellID, opID, tcpBuffer, bufferOffset, dataLen, restDataLen, withHeader)
    recvData(tcpBuffer, msgHandler) {
        const tcpPackageLen = tcpBuffer.byteLength;

        if (this._bwDataPool == 0) {
            this._bwTime = Date.now();  
            this._bwParseTime = 0;  
        }

        this._bwDataPool += tcpPackageLen;
        if (this._bwDataPool > 10*1024*1024) {
            const t = Date.now() - this._bwTime;
            const d = this._bwDataPool;
            this._bw = d / t * 1000.0 / 1024.0 / 1024.0;
            console.log(`socket client bw: ${this._bw}, parse time: ${this._bwParseTime}`);

            this._bwDataPool = 0;
        }

        const p_t0 = Date.now();
        if (this._tcpPacketEnd == 0) {
            if (tcpPackageLen < MSG_HEADER_LEN) { //incompleted Msg header
                let dstBuffer = new Uint8Array(this._lastMsgHeader);
                let srcBuffer = new Uint8Array(tcpBuffer)
                for (let i = 0; i< tcpPackageLen; ++i) {
                    dstBuffer[i] = srcBuffer[i];
                }
                this._tcpPacketEnd = 2;
                this._lastMsgHeaderLen = tcpPackageLen;
                return;
            }
            let header = new Uint32Array(tcpBuffer, 0, 8);
            this._msgCmdID = header[2];
            this._msgCellID = header[3];
            this._msgOpID = header[4];
            const lastMsgDatalen = header[7];
    
            if (tcpPackageLen - MSG_HEADER_LEN == lastMsgDatalen) { // completed one Msg
                msgHandler(this._msgCmdID, this._msgCellID, this._msgOpID, tcpBuffer, MSG_HEADER_LEN, lastMsgDatalen, 0, true);
            } else if (tcpPackageLen - MSG_HEADER_LEN < lastMsgDatalen) { // not completed one Msg
                this._msgRestDataLen = lastMsgDatalen - (tcpPackageLen - MSG_HEADER_LEN);
                msgHandler(this._msgCmdID, this._msgCellID, this._msgOpID, tcpBuffer, MSG_HEADER_LEN, tcpPackageLen - MSG_HEADER_LEN, this._msgRestDataLen, true);
                this._tcpPacketEnd = 1;
            } else { // this buffer carry next Msg process current one
                msgHandler(this._msgCmdID, this._msgCellID, this._msgOpID, tcpBuffer, MSG_HEADER_LEN, lastMsgDatalen, 0, true);
                // recursion process rest
                let tcpBufferSub = tcpBuffer.slice(lastMsgDatalen + MSG_HEADER_LEN);
                this._tcpPacketEnd = 0;
                this.recvData(tcpBufferSub, msgHandler);
            }
        } else if (this._tcpPacketEnd == 1) { // data for last msg
            if (tcpPackageLen - this._msgRestDataLen == 0) { // complete last msg
                this._msgRestDataLen = 0;
                this._tcpPacketEnd = 0;
                msgHandler(this._msgCmdID, this._msgCellID, this._msgOpID, tcpBuffer, 0, tcpPackageLen, 0, false);
            } else if (tcpPackageLen - this._msgRestDataLen < 0) { // not complete data yet
                this._msgRestDataLen -= tcpPackageLen;
                this._tcpPacketEnd = 1;
                msgHandler(this._msgCmdID, this._msgCellID, this._msgOpID, tcpBuffer, 0, tcpPackageLen, this._msgRestDataLen, false);
            } else { // this buffer carry next Msg
                msgHandler(this._msgCmdID, this._msgCellID, this._msgOpID, tcpBuffer, 0, this._msgRestDataLen, 0, false);
                let tcpBufferSub2 = tcpBuffer.slice(this._msgRestDataLen);
                this._msgRestDataLen = 0;
                this._tcpPacketEnd = 0;
                this.recvData(tcpBufferSub2, msgHandler);
            }
        } else if (this._tcpPacketEnd == 2) { // msg header for last msg header
            const lastRestHeaderLen = MSG_HEADER_LEN - this._lastMsgHeaderLen;
            if (tcpPackageLen < lastRestHeaderLen) { // msg header is not completed yet
                let dstBuffer = new Uint8Array(this._lastMsgHeader);
                let srcBuffer = new Uint8Array(tcpBuffer)
                for (let i = 0 ; i< tcpPackageLen; ++i) {
                    dstBuffer[i+this._lastMsgHeaderLen] = srcBuffer[i];
                }
                this._tcpPacketEnd = 2;
                this._lastMsgHeaderLen += tcpPackageLen;
                return;
            } else { // msg header is completed
                //fill header completed
                let dstBuffer = new Uint8Array(this._lastMsgHeader);
                let srcBuffer = new Uint8Array(tcpBuffer,0,lastRestHeaderLen);
                for (let i = 0; i< lastRestHeaderLen; ++i) {
                    dstBuffer[i+this._lastMsgHeaderLen] = srcBuffer[i];
                }
    
                let tcpBufferSub3 = tcpBuffer.slice(lastRestHeaderLen);
                let header2 = new Uint32Array(this._lastMsgHeader, 0, 8);
                this._msgCmdID = header2[2];
                this._msgCellID = header2[3];
                this._msgOpID = header2[4];
                this._msgRestDataLen = header2[7];
    
                this._tcpPacketEnd = 1;
                this._lastMsgHeaderLen = 0;
                this.recvData(tcpBufferSub3, msgHandler);
            }
        }
        const p_t1 = Date.now();
        this._bwParseTime += p_t1 - p_t0;
    }
}