{
  function compare_arg(a, b) {
    if (a == b) return true;
    if (b == "<anything>") return true;
    if (b == "<feature>" && (a == "<value>" || a == "<values>")) return true;
    return false;
  }
  function compare_args(a, b, oneormore) {
    if (a == b) {
      return true;
    }
    if(oneormore) {
      for(let i=0; i< b.length; i++) {
        if (!compare_arg(a, b[i])) {
          return false;
        }
      }
    } else {
      for(let i=0; i< a.length; i++) {
        if (!compare_arg(a[i], b[i])) {
          return false;
        }
      }
    }
    return true;
  }
  function args2text(args) {
    let ret = [];
    if (args[0] !== undefined) {
      ret.push("<value>+")
    }
    for(let i=1; i<args.length; i++) {
      if (args[i] !== undefined) {
        ret.push(args[i][0].join(","));
      }
    }
    return ret.join(" or ");
  }
  function defChecker() {
    this.functions = new Map();
    this.verbs = new Map();
    this.addFunction = function(name, args, ret) {
      args = args[0];
      let id = args.length;
      if (typeof args[0] == "object" && args[0].type == "oneormore") {
        id = 0;
        args = args[0].term;
      }
      if (this.functions.has(name)) {
        this.functions.get(name)[id] = [args, ret];
      } else {
        let arr = []
        arr[id] = [args, ret];
        this.functions.set(name, arr);
      }
    }
    this.addVerb = function(name, ret) {
      this.verbs.set(name, ret);
    }
    this.check = function(item, args, err) {
      let ret;
      switch(item.type) {
        case "feature":
          if (item.name.startsWith('__')) {
            return "<feature>";
          }
          if (item.name.startsWith('_')) {
            //check feature
            return "<feature>";
          }
          ret = this.verbs.get(item.name);
          if (ret !== undefined) {
            return ret;
          }
          //check feature
          return "<feature>";
        case "number":
          return this.verbs.get("<free-float>");
        case "boolean":
          return this.verbs.get("<boolean>");
        case "function":
          if (item.name.startsWith('__')) {
            return "<value>";
          }
          if (item.name.startsWith('_')) {
            //check feature
            return "<value>";
          }
          ret = this.functions.get(item.name);
          if (ret === undefined) {
            item.error = "Function not found";
            err.push(item);
            return "<anything>";
          }
          let n = args.length;
          if (ret[n] !== undefined && compare_args(ret[n][0], args)) {
            return ret[n][1];
          }
          if (ret[0] !== undefined && compare_args(ret[0][0], args, true)) {
            return ret[0][1];
          }
          item.error = "Wrong arguments. Got "+args.join(",")+"; Available variant(s): "+args2text(ret);
          err.push(item);
          return "<anything>";
      }
    }
  }

  var defs = new defChecker();

  function appendTerm(type, terms) {
      for(let i=0; i<terms.length; i++) {
          switch(typeof terms[i]) {
              case "string":
                  if (terms[i] == "<feature>" || type == "<feature>") {
                      continue;
                  }
                  defs.addVerb(terms[i], type);
                  continue;
              case "boolean":
                  defs.addVerb("<boolean>", type);
                  continue;
              case "object":
                  let key=Object.keys(terms[i])[0];
                  defs.addFunction(key, terms[i][key], type)
                  continue;
          }
      }
  }
}

Specifications
  = specs:(spec:Specification? [ \t]* '\n' {return spec;})* { return defs; }

Specification
  = [ \t]* Comment {} /
    [ \t]* type:Type _ "->" _ terms:Terms [ \t]* Comment? { appendTerm(type, terms); }

Terms
  = head:Value tail:(_ '|' _ t:Value { return t;})* { return [head].concat(tail); }

Value
  = Null /
    t:Type _ '+' { return {type: 'oneormore', term:t}; }  /
  	Type /
    Object /
    Array /
    String /
    Bool

Object
  ='{' _ prop:Properties _ '}' { return prop; }

Properties
  = head:Property tail:(_ ',' _ p:Property { return p; })* { return Object.assign({}, head, ...tail); }
  
Property
  = key:String _ ':' _ value:Terms { let ret = {}; ret[key] = value; return ret }

Array
  = '[' head:Value tail:(_ ',' _ t:Value {return t;})* ']' {return [head].concat(tail);} 

Type
  = '<' ([^>]+) '>' { return text(); }
  
String
  = '"' s:([^"]+ {return text();}) '"' { return s; }
  
Null
  = 'null'i { return null; }

Bool
  = ('true'i/'false'i) { return text().toLowerCase() == "true"; }

Comment "Comment"
  = '#' [^\n]*

_ "whitespace"
  = [ \t]* (Comment? '\n')* [ \t]*
              