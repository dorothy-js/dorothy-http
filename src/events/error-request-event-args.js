import { Event } from '@pollon/message-broker'

export class ErrorRequestEvent extends Event{
    constructor( name, reason, args ){
        super(name)
        this.reason = reason
        this.args = args
    }
}
