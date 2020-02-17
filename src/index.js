import { Fetch } from './fetch'

export const Http = {
    install: ( App, config ) =>{
        App.Http = new Fetch(App)
    }
}
