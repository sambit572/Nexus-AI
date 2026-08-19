import "./Auth.css";
import { useState } from "react";

// Shown whenever there's no valid (unexpired) token in localStorage.
// Handles both signup and login in one component, toggled with a link.
function Auth({ onAuthSuccess }){
    const [mode,setMode]=useState("signup"); // "signup" | "login"
    const [name,setName]=useState("");
    const [email,setEmail]=useState("");
    const [password,setPassword]=useState("");
    const [showPassword,setShowPassword]=useState(false);
    const [error,setError]=useState("");
    const [loading,setLoading]=useState(false);

    const isSignup = mode === "signup";

    const switchMode=()=>{
        setMode(isSignup ? "login" : "signup");
        setError("");
        setPassword("");
    };

    const handleSubmit=async(e)=>{
        e.preventDefault();
        setError("");

        if(isSignup && name.trim().length < 2){
            setError("Please enter your full name.");
            return;
        }
        if(!email.trim()){
            setError("Please enter your email.");
            return;
        }
        if(password.length < 6){
            setError("Password must be at least 6 characters.");
            return;
        }

        setLoading(true);
        try{
            const endpoint = isSignup ? "signup" : "login";
            const body = isSignup ? {name,email,password} : {email,password};

            const response = await fetch(`http://localhost:8080/api/auth/${endpoint}`,{
                method:"POST",
                headers:{"Content-Type":"application/json"},
                body: JSON.stringify(body)
            });
            const data = await response.json();

            if(!response.ok){
                setError(data.error || "Something went wrong. Please try again.");
                setLoading(false);
                return;
            }

            onAuthSuccess(data.token, data.user);
        } catch(err){
            console.log(err);
            setError("Couldn't reach the server. Please try again.");
            setLoading(false);
        }
    };

    return (
        <div className="authPage">
            <div className="authBlobs" aria-hidden="true">
                <span className="blob blobOne"></span>
                <span className="blob blobTwo"></span>
                <span className="blob blobThree"></span>
            </div>

            <div className="authCard">
                <div className="authBrand">
                    <span className="authLogo"><i className="fa-solid fa-sparkles"></i></span>
                    <span className="authBrandName">Nexus AI</span>
                </div>

                <h1 className="authHeading">
                    {isSignup ? "Create your account" : "Welcome back"}
                </h1>
                <p className="authSubtext">
                    {isSignup
                        ? "Join Nexus AI and start chatting with your own AI personas."
                        : "Log in to pick up right where you left off."}
                </p>

                <form className="authForm" onSubmit={handleSubmit}>
                    <div className={"authFieldsSlide" + (isSignup ? "" : " loginMode")}>
                        {
                            isSignup &&
                            <div className="authField">
                                <i className="fa-solid fa-user"></i>
                                <input
                                    type="text"
                                    placeholder="Full name"
                                    value={name}
                                    onChange={(e)=>setName(e.target.value)}
                                    autoComplete="name"
                                />
                            </div>
                        }
                        <div className="authField">
                            <i className="fa-solid fa-envelope"></i>
                            <input
                                type="email"
                                placeholder="Email address"
                                value={email}
                                onChange={(e)=>setEmail(e.target.value)}
                                autoComplete="email"
                            />
                        </div>
                        <div className="authField">
                            <i className="fa-solid fa-lock"></i>
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="Password"
                                value={password}
                                onChange={(e)=>setPassword(e.target.value)}
                                autoComplete={isSignup ? "new-password" : "current-password"}
                            />
                            <i
                                className={"togglePw fa-solid " + (showPassword ? "fa-eye-slash" : "fa-eye")}
                                onClick={()=>setShowPassword(!showPassword)}
                            ></i>
                        </div>
                    </div>

                    {
                        error &&
                        <p className="authError">
                            <i className="fa-solid fa-circle-exclamation"></i> {error}
                        </p>
                    }

                    <button type="submit" className="authSubmitBtn" disabled={loading}>
                        {
                            loading
                                ? <i className="fa-solid fa-spinner fa-spin"></i>
                                : <>{isSignup ? "Create account" : "Log in"} <i className="fa-solid fa-arrow-right"></i></>
                        }
                    </button>
                </form>

                <p className="authSwitch">
                    {isSignup ? "Already have an account?" : "New to Nexus AI?"}
                    <span onClick={switchMode}> {isSignup ? "Log in" : "Sign up"}</span>
                </p>
            </div>
        </div>
    );
}

export default Auth;
