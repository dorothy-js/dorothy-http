import { Publisher } from '@pollon/message-broker'
import { EVENTS } from './events/repository'
import { ErrorRequestEvent } from './events/error-request-event-args'
import { RequestEvent, RequestResolvedEvent, RequestTimedoutEvent } from './events/request-event-args'

const DEFAULT_PARAMETERS = {
    method: 'GET',
    headers: {},
    credentials: 'omit'
}

export class Fetch{

    get EVENTS(){
        return EVENTS
    }

    constructor( app ){
        this.publisher = new Publisher(Object.values(EVENTS))
        this.requestFilters = []
        app.Bus.add(this.publisher)
    }

    addStatusCheck( filter ){
        this.requestFilters.push(filter)
    }

    checkStatus( label ){
        if( !Array.isArray(this.requestFilters) ){
            return Promise.reject('Pollon: [transport:http] Invalid Datalayer request filters')
        }
        let filters

        filters = this.requestFilters.map( f =>{
            if( f instanceof Promise ){
                return f
            }

            if( f instanceof Function ){
                return f()
            }
            return f
        })


        return new Promise(( resolve, reject ) => {
            Promise.all(filters)
                .then( res =>{
                    for( let i = 0; i < res.length; i++ ){
                        if( !res[i] ){
                            reject()
                        }
                    }
                    resolve(res)
                }).catch(reason =>{
                    reject(`Pollon: [transport:http:checkstatus] cannot execute ${label}. Some filters blocked the request`)
                })
        })
    }

    make( label, req, ignoreCheckStatus ){
        if( !req || !req.url ){
            throw new Error(`Pollon: [transport:http:make] cannot make "${label}". Configuration is missing or is incorrect.`)
        }
        let timeout = 5000
        let options = Object.assign({}, DEFAULT_PARAMETERS, {name: label}, req || {})
        let done = false
        return Promise.race([
            new Promise(( resolve, reject ) =>{
                let retries, run

                retries = 5
                run = () =>{
                    let promise

                    if( !ignoreCheckStatus ){
                        promise = Promise.resolve(true)
                    }else{
                        promise = this.checkStatus(label)
                    }

                    promise.then(() =>{
                        fetch(req.url, options)
                            .then( response =>{
                                resolve(response)
                                done = true
                                this.publisher.fire(EVENTS.REQUEST_RESOLVED, new RequestResolvedEvent(options, response))
                            })
                            .catch( reason =>{
                                --retries
                                if( retries <= 0 ){
                                    done = true
                                    reason = `Pollon: [transport:http:make] Too many retry. ${reason}`
                                    options.rerun = ( () =>{} )
                                    this.publisher.fire(EVENTS.REQUEST_BLOCKED, new ErrorRequestEvent(EVENTS.REQUEST_BLOCKED, reason, options))
                                    reject(reason)
                                    return
                                }

                                this.publisher.fire(EVENTS.REQUEST_REJECTED, new ErrorRequestEvent(EVENTS.REQUEST_REJECTED, reason, options))
                            })
                    })
                        .catch( reason =>{
                            done = true
                            this.publisher.fire(EVENTS.REQUEST_BLOCKED, new ErrorRequestEvent(EVENTS.REQUEST_BLOCKED, reason, options))
                            reject(reason)
                        })

                }
                options.rerun = run
                this.publisher.fire(EVENTS.REQUEST_ISSUED, new RequestEvent(options))
                run()
            }),
            new Promise((_, reject) => setTimeout(() => {
                if( !done ){
                    this.publisher.fire(EVENTS.REQUEST_TIMEDOUT, new RequestTimedoutEvent(EVENTS.REQUEST_TIMEDOUT, options))
                }
            }, timeout) )
        ])
    }

    get( label, req ){
        req.method = 'GET'
        return this.make(label, req)
    }

    post( label, req ){
        req.method = 'POST'
        return this.make(label, req)
    }

}
