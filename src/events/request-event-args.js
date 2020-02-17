import { Event } from '@pollon/message-broker'
import { EVENTS } from './repository'

export class RequestTimedoutEvent extends Event{
    constructor( req ){
        super(EVENTS.REQUEST_TIMEDOUT)
        this.request = req
    }
}

export class RequestResolvedEvent extends Event{
    constructor( req, res ){
        super(EVENTS.REQUEST_RESOLVED)
        this.request = req
        this.response = res
    }
}

export class RequestEvent extends Event{
    constructor( req ){
        super(EVENTS.REQUEST_ISSUED)
        this.request = req
    }
}
