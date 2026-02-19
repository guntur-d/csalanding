import m from 'mithril';
import { toast, Toaster } from '@moriajs/ui';

export default {
    password: '',
    loading: false,

    login: async function (e: Event) {
        e.preventDefault();
        if (this.loading) return;

        this.loading = true;
        try {
            const response: any = await m.request({
                method: 'POST',
                url: '/api/auth/login',
                body: { password: this.password }
            });

            if (response.success) {
                window.location.href = '/admin';
            }
        } catch (err: any) {
            toast.error(err.response?.error || 'Login failed');
        } finally {
            this.loading = false;
        }
    },

    view: function () {
        return m('.login-layout', {
            style: `
                background: #111;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: 'Outfit', sans-serif;
                color: #fff;
            `
        }, [
            m(Toaster),
            m('.login-card', {
                style: `
                    background: #1a1a1a;
                    padding: 3rem;
                    border-radius: 20px;
                    border: 1px solid #333;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.5);
                    width: 100%;
                    max-width: 400px;
                    text-align: center;
                `
            }, [
                m('h2', { style: 'color: #c5a059; margin-bottom: 0.5rem;' }, 'CSA Admin'),
                m('p', { style: 'color: #888; margin-bottom: 2rem; font-size: 0.9rem;' }, 'Please enter your password to continue'),

                m('form', { onsubmit: (e: any) => this.login(e) }, [
                    m('.form-group', { style: 'margin-bottom: 2rem; text-align: left;' }, [
                        m('label', { style: 'display: block; margin-bottom: 0.5rem; color: #aaa; font-size: 0.8rem;' }, 'Password'),
                        m('input[type=password]', {
                            placeholder: '••••••••',
                            style: `
                                width: 100%;
                                padding: 1rem;
                                background: #111;
                                border: 1px solid #333;
                                border-radius: 10px;
                                color: #fff;
                                outline: none;
                                transition: 0.3s;
                            `,
                            oninput: (e: any) => this.password = e.target.value,
                            value: this.password
                        })
                    ]),
                    m('button.btn', {
                        type: 'submit',
                        disabled: this.loading,
                        style: `
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
                            opacity: ${this.loading ? 0.5 : 1}
                        `
                    }, this.loading ? 'VERIFYING...' : 'ACCESS CMS')
                ])
            ])
        ]);
    }
};
