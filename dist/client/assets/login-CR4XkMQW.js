import{m as o}from"./index-CMj6JYxd.js";import{T as i,t as a}from"./index-C128AHEg.js";const l={password:"",loading:!1,login:async function(t){var r;if(t.preventDefault(),!this.loading){this.loading=!0;try{(await o.request({method:"POST",url:"/api/auth/login",body:{password:this.password}})).success&&(window.location.href="/admin")}catch(e){a.error(((r=e.response)==null?void 0:r.error)||"Login failed")}finally{this.loading=!1}}},view:function(){return o(".login-layout",{style:`
                background: #111;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: 'Outfit', sans-serif;
                color: #fff;
            `},[o(i),o(".login-card",{style:`
                    background: #1a1a1a;
                    padding: 3rem;
                    border-radius: 20px;
                    border: 1px solid #333;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.5);
                    width: 100%;
                    max-width: 400px;
                    text-align: center;
                `},[o("h2",{style:"color: #c5a059; margin-bottom: 0.5rem;"},"CSA Admin"),o("p",{style:"color: #888; margin-bottom: 2rem; font-size: 0.9rem;"},"Please enter your password to continue"),o("form",{onsubmit:t=>this.login(t)},[o(".form-group",{style:"margin-bottom: 2rem; text-align: left;"},[o("label",{style:"display: block; margin-bottom: 0.5rem; color: #aaa; font-size: 0.8rem;"},"Password"),o("input[type=password]",{placeholder:"••••••••",style:`
                                width: 100%;
                                padding: 1rem;
                                background: #111;
                                border: 1px solid #333;
                                border-radius: 10px;
                                color: #fff;
                                outline: none;
                                transition: 0.3s;
                            `,oninput:t=>this.password=t.target.value,value:this.password})]),o("button.btn",{type:"submit",disabled:this.loading,style:`
                            width: 100%;
                            padding: 1rem;
                            background: #c5a059;
                            color: #111;
                            border: none;
                            border-radius: 10px;
                            font-weight: bold;
                            cursor: pointer;
                            transition: 0.3s;
                            letter-spacing: 0.1em;
                            opacity: ${this.loading?.5:1}
                        `},this.loading?"VERIFYING...":"ACCESS CMS")])])])}};export{l as default};
